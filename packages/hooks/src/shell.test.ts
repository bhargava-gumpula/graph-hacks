import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { changedFiles, dirtyFiles, readOnly, writeTargets } from "./shell.js";

describe("writeTargets", () => {
  test.each([
    ["echo hi > out.txt", ["out.txt"]],
    ["echo hi >> logs/a.log", ["logs/a.log"]],
    ["printf x>b.ts", ["b.ts"]],
    ["cmd 2> err.txt", ["err.txt"]],
    ["cmd &> all.txt", ["all.txt"]],
    ['echo "a > b" > "my file.ts"', ["my file.ts"]],
    ["echo x | tee -a a.ts b.ts", ["a.ts", "b.ts"]],
    ["sed -i 's/a/b/' src/x.ts", ["src/x.ts"]],
    ["sed -i '' 's/a/b/' src/x.ts src/y.ts", ["src/x.ts", "src/y.ts"]],
    ["sed -i.bak -e 's/a/b/' src/x.ts", ["src/x.ts"]],
    ["sed --in-place 's/a/b/' x.ts", ["x.ts"]],
    ["mv a.ts b.ts", ["a.ts", "b.ts"]],
    ["cp -r src/a.ts src/b.ts", ["src/b.ts"]],
    ["rm -f auth/session.ts", ["auth/session.ts"]],
    ["touch new.ts && echo ok", ["new.ts"]],
    ["git checkout -- ui/LoginForm.tsx api/login.ts", ["ui/LoginForm.tsx", "api/login.ts"]],
    ["FOO=1 sudo touch z.ts", ["z.ts"]],
    ["cat > notes.md <<'EOF'\nline > other.ts\nEOF", ["notes.md"]],
  ])("%s writes %j", (cmd, want) => {
    expect(writeTargets(cmd)).toEqual(want);
  });

  test.each([
    "ls -la",
    "cat auth/session.ts",
    "grep -rn 'a > b' src",
    "git status && git diff --stat",
    "sed -n '1,10p' auth/session.ts",
    "npm test > /dev/null 2>&1",
    "echo hi >&2",
    "find . -name '*.ts' | head",
    "git checkout main",
    "git log --oneline -5 | cat",
    "echo $(date) > out.txt",
    "rm -f *.log",
    "echo x > $OUT",
    "cd sub && touch a.ts",
    "echo 'unterminated > x",
    "",
  ])("%j writes nothing", (cmd) => {
    expect(writeTargets(cmd)).toEqual([]);
  });
});

describe("dirtyFiles / changedFiles", () => {
  const repo = mkdtempSync(join(tmpdir(), "sb-shell-"));
  afterAll(() => rmSync(repo, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { stdio: "ignore" });

  test("finds files a command created, changed, deleted or reverted", () => {
    git("init", "-q", "-b", "main");
    writeFileSync(join(repo, "a.ts"), "a\n");
    writeFileSync(join(repo, "b.ts"), "b\n");
    writeFileSync(join(repo, "c.ts"), "c\n");
    git("add", "-A");
    git("commit", "-qm", "init");
    writeFileSync(join(repo, "c.ts"), "dirty before\n");
    utimesSync(join(repo, "c.ts"), new Date(1000), new Date(1000));
    const before = dirtyFiles(repo);
    const top = realpathSync(repo);
    expect(Object.keys(before)).toEqual([join(top, "c.ts")]);

    writeFileSync(join(repo, "a.ts"), "changed\n");
    unlinkSync(join(repo, "b.ts"));
    writeFileSync(join(repo, "new.ts"), "n\n");
    git("checkout", "--", "c.ts");
    expect(changedFiles(before, dirtyFiles(repo))).toEqual(["a.ts", "b.ts", "c.ts", "new.ts"].map((f) => join(top, f)));
    expect(changedFiles(dirtyFiles(repo), dirtyFiles(repo))).toEqual([]);
  });
});

describe("readOnly", () => {
  test.each([
    "ls -la",
    "cat a.ts && grep -n x b.ts | head -5",
    "git status --short",
    "git -C /r --no-pager diff HEAD~1",
    "sed -n '1,40p' src/a.ts",
    "find . -name '*.ts' 2>/dev/null | wc -l",
    "cd packages && ls",
    "rg foo src > /dev/null 2>&1",
    "FOO=1 cat x",
  ])("reads only: %s", (command) => expect(readOnly(command)).toBe(true));

  test.each([
    "npm test",
    "echo hi > out.txt",
    "cat a | tee b",
    "sed -i '' 's/a/b/' f.ts",
    "sed 's/a/b/w out' f.ts",
    "find . -name x -delete",
    "sort -o out.txt in.txt",
    "ls $(cat list)",
    "cat <<EOF > f.ts",
    "sleep 1 & rm x",
    "git checkout main",
    "git diff --output=patch.txt",
    "(cd x; rm y)",
    "for f in *; do rm $f; done",
    "rm -rf build",
    'echo "unterminated',
  ])("may write: %s", (command) => expect(readOnly(command)).toBe(false));
});

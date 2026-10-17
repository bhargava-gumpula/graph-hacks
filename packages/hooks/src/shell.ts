// Shell writes for the editor hook: which files an obvious write command touches (claimed before it runs),
// and which files a command actually changed (git status before and after, recorded as edits).
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

/** Split into words with simple shell quoting. `null` for anything we will not guess at. */
function words(segment: string): string[] | null {
  const out: string[] = [];
  let cur = "";
  let has = false;
  let quote: string | null = null;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < segment.length) cur += segment[++i];
      else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
    } else if (ch === "\\" && i + 1 < segment.length) {
      cur += segment[++i];
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) out.push(cur);
      cur = "";
      has = false;
    } else if (ch === ">") {
      // A redirection is its own word: `>`, `>>`, `>|`, `2>`, `&>`, with its target split off.
      const fd = /^(\d|&)$/.test(cur) && !has ? cur : "";
      if (cur && !fd) out.push(cur);
      let op = `${fd}>`;
      if (segment[i + 1] === ">" || segment[i + 1] === "|") op += segment[++i];
      out.push(op);
      cur = "";
      has = false;
    } else cur += ch;
  }
  if (quote) return null;
  if (has || cur) out.push(cur);
  return out;
}

const SAFE_TARGET = (t: string) => t !== "" && !/[*?[\]$`(){}~]/.test(t) && !t.startsWith("/dev/") && !t.startsWith("&");
const operands = (args: string[]) => {
  const out: string[] = [];
  let opts = true;
  for (const a of args) {
    if (opts && a === "--") opts = false;
    else if (opts && a.startsWith("-") && a !== "-") continue;
    else out.push(a);
  }
  return out;
};

/**
 * Files an obvious write command touches: `>`/`>>` redirections, `tee`, `sed -i`, `mv`, `cp` (the target),
 * `rm`, `touch`, `git checkout -- <file>`. Conservative: anything unclear (globs, variables, command
 * substitution, unmatched quotes) is left out, so a read-only command never yields a path.
 */
export function writeTargets(command: string): string[] {
  try {
    // A heredoc body is data, not commands: only its first line is read.
    const text = command.includes("<<") ? command.split("\n")[0]! : command;
    // Command substitution, or a `cd` that moves relative paths somewhere we can't follow.
    if (/\$\(|`|(^|[;&|]\s*)(cd|pushd)\s/.test(text)) return [];
    const found = new Set<string>();
    for (const segment of text.split(/&&|\|\||[;|\n]/)) {
      const w = words(segment.trim());
      if (!w || w.length === 0) continue;
      const rest: string[] = [];
      for (let i = 0; i < w.length; i++) {
        if (/^(\d|&)?>[>|]?$/.test(w[i]!)) {
          const target = w[++i];
          if (target !== undefined && SAFE_TARGET(target)) found.add(target);
        } else rest.push(w[i]!);
      }
      while (rest.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0]!)) rest.shift();
      if (rest[0] === "sudo" || rest[0] === "command") rest.shift();
      const [cmd, ...args] = rest;
      let targets: string[] = [];
      if (cmd === "tee" || cmd === "rm" || cmd === "touch" || cmd === "mv") targets = operands(args);
      else if (cmd === "cp") targets = operands(args).slice(-1);
      else if (cmd === "sed" && args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place"))) {
        // `sed -i 's/a/b/' f` (the first operand is the script) or `sed -i -e s/a/b/ f` (no script operand).
        const scripted = args.some((a) => a === "-e" || a === "-f" || a === "--expression" || a === "--file");
        const ops = operands(args.filter((a, i) => !(args[i - 1] === "-e" || args[i - 1] === "-f"))).filter((a) => a !== "");
        targets = scripted ? ops : ops.slice(1);
      } else if (cmd === "git" && args[0] === "checkout" && args.includes("--")) targets = args.slice(args.indexOf("--") + 1);
      for (const t of targets) if (SAFE_TARGET(t)) found.add(t);
    }
    return [...found];
  } catch {
    return [];
  }
}

/** Dirty and untracked files of the git checkout around `dir`, by absolute path, each with its mtime (0 once deleted). */
export function dirtyFiles(dir: string): Record<string, number> {
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 });
  // Porcelain paths are relative to the top level, whatever directory git runs in.
  const top = git("rev-parse", "--show-toplevel").trim();
  const entries = git("status", "--porcelain", "-z", "--untracked-files=all").split("\0");
  const files: Record<string, number> = {};
  const mtime = (path: string) => {
    try {
      return statSync(path).mtimeMs;
    } catch {
      return 0;
    }
  };
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.length < 4) continue;
    // A rename is followed by its old path: both changed.
    if (e[0] === "R" || e[0] === "C") files[join(top, entries[++i]!)] = 0;
    const path = join(top, e.slice(3));
    files[path] = mtime(path);
  }
  return files;
}

/** Files that changed between two `dirtyFiles` snapshots: new, touched again, or reverted to clean. */
export function changedFiles(before: Record<string, number>, after: Record<string, number>): string[] {
  const changed = Object.keys(after).filter((p) => before[p] !== after[p]);
  for (const p of Object.keys(before)) if (!(p in after)) changed.push(p);
  return changed.sort();
}

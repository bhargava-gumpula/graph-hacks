# night-n4: README with generated Cypher, submission docs, judge Q&A, deploy files

Branch `night/n4` (base `bdb2eec`). Server for checks: port 8814, graph `sb_night_n4`, `SB_TEST_NS=_n4`. Nothing was installed or deployed: no `cloudflared login`, `wrangler`, `launchctl`, or `install.sh`.

## What I did

1. **`scripts/readme-gen.ts`** (`npm run readme`). Imports `conflictQuery(3)`, `conflictGuard(3)`, `claimQuery(3)`, `blastQuery(3)`, `interfereQuery(3)`, `WCC_BATCHES`, `MARK_HUBS`, `WHY_TRACE` and `NEAR_FILES` straight from `packages/core/src/queries/*.ts`. All nine already exist on `ui/rebuild`, so it works on this branch without N3. A missing export stops it with `does not export <name>. Merge the core package (N3) first.` (tested by renaming one). It writes 9 `cypher` blocks between `<!-- cypher:start/end -->` and the benchmark and census numbers between `<!-- bench:start/end -->`. Each query gets a one-line "why a lock table cannot do this". Idempotent: two runs, no diff.
2. **README rewrite** in the order of the brief (title, GIF, link row, uptime badge; 30 seconds; why a graph; quickstart; plug in your agent; graph model; the Cypher plus the `GRAPH.PROFILE` excerpt; architecture; benchmark; FalkorDB lessons; limits; competitors; AI disclosure; license). No `/judge`.
3. **LICENSE** MIT, 2026, Bhargava G.
4. **docs/DEMO.md** shot list (ends at 2:00), burned-in captions, pre-record checklist, "do not say" list.
5. **docs/JUDGE-QA.md** 12 questions, at most 2 sentences each, plus a small table of numbers. **PLAN §9**: Q12 and Q14 rewritten (only those two lines changed).
6. **docs/HACKATHON.md** deadline is `Sun Oct 18 11:29 AM PT` in the table and in both prose places. The internal deadline line said `Sat Oct 17, 11 PM PT`; PLAN.md line 23 and UI-REBUILD.md say submit by Sun 10:30 AM, so it now says that.
7. **docs/blog.md** draft, about 1,400 words counting the code block, headings and links (about 1,270 of prose).
8. **Deploy files**: `deploy/cloudflared.yml`, `deploy/xyz.switchboard.server.plist`, `deploy/xyz.switchboard.tunnel.plist`, `deploy/install.sh`, `deploy/RUNBOOK.md` (rewritten: variables, the 7-step sequence, kill-test rehearsal, host checklist, taking it down), `.github/workflows/uptime.yml`.
9. **scripts/record-hero.mjs** and **docs/blog-assets/conflict.gif** (3.68 MB, 800 px wide, 12 fps).
10. **.gitignore**: `shots/`, `.claude/settings.local.json`, `.claude/skills/`. Nothing was untracked (see follow-ups).
11. **package.json** scripts only: added `readme`, `self`, and `pairs` (`tsx scripts/pairs.ts`, N7's script; it exists after N7 merges, which it did on `ui/rebuild`).

## Decisions and deviations

- **Port**: used 8814 (COMMON.md), not 8794 (the brief).
- **install.sh** does a little more than the brief: it lints the plists, checks that `node`, the repo's `node_modules/tsx`, `cloudflared` and `~/.cloudflared/config.yml` exist and that no `<UUID>` is left, runs `launchctl bootout` first so it can be run again, and creates `~/Library/Logs/switchboard/` (launchd will not). Then, as asked: copy to `~/Library/LaunchAgents`, `bootstrap gui/$(id -u)`, `kickstart -k`.
- **Tunnel plist** also has `RunAtLoad` and `ThrottleInterval 10` (the brief only said KeepAlive).
- **uptime.yml** adds `--retry 2 --retry-delay 5` to the curl and `permissions: {}`.
- **record-hero.mjs** starts the GIF just before the Play request, tries 1280, 1100, 960, 800, 640 px until the file is under 5,000,000 bytes (decimal), uses `max_colors=96`. If `/app?play=1` does not start the demo itself (it does not on this branch), it presses the Play button. It waits for a caption text (`CAPTION`, default the end of the refusal sentence).
- **Benchmark text** follows N7's merged `bench/REPORT.md` on `ui/rebuild` (B refused, A releases, B's own tsc stops its edit). The census uses N7's `dir` field, so the real repo is `apps/web/` (103 files), not `apps/web/src/`.
- **Hub wording** follows the brief: paths never pass through a hub, and a claim on a hub conflicts with its importers (N3's `nodes(p)[1..-1]`; I read N3's branch). I removed the claim in the old docs that a hub "links everything to everything": `lib/utils.ts` imports nothing, and the conflict and scheduler checks follow imports in one direction, so two files that merely share a hub never reach each other. The hub rule matters for the briefing's both-directions walk (`NEAR_FILES`) and for claims on the hub itself.
- **Agent teams**: the old README said Claude Code agent teams lock files by name. The competitor sheet says their task claiming uses file locking and their docs tell you to give teammates different files. The README now says the second thing.
- **DEMO.md pre-record, hooks**: the hooks reach whichever server `SB_URL` points at (default :8787), so keeping the owner's own hooks out of the filmed graph needs a second server on a scratch graph (`SERVER_PORT=8790 SB_GRAPH=sb_dev`) and `SB_URL=http://localhost:8790` in every other shell, not only `SB_GRAPH=sb_dev`. Both are written down.
- **Claim TTL**: `POST /api/demo` leaves A holding `session.ts` for 30 minutes. DEMO.md says to film within 30 minutes of the reset.

## Domain placeholders (swap in one pass)

API host `switchboard-api.bhargava-gumpula.com` and site host `switchboard.bhargava-gumpula.com` appear only here:

| File | What |
|---|---|
| `README.md` line 7 | the link row (Live demo, API health) |
| `docs/blog.md` line 80 | Live demo link |
| `deploy/RUNBOOK.md` lines 16-17 | `SITE` and `API` variables |
| `deploy/cloudflared.yml` lines 9-10 | comment and `hostname:` |
| `.github/workflows/uptime.yml` lines 12-13 | `API_URL`, `SITE_URL` |

One pass (API first, because the site host is a substring of it):

```bash
sed -i '' 's/switchboard-api\.bhargava-gumpula\.com/NEW-API-HOST/g; s/switchboard\.bhargava-gumpula\.com/NEW-SITE-HOST/g' \
  README.md docs/blog.md deploy/RUNBOOK.md deploy/cloudflared.yml .github/workflows/uptime.yml
```

The GitHub repo URL `https://github.com/bhargava-gumpula/graph-hacks` (README badge, blog link) comes from `git remote`.

## For the orchestrator (outside my files)

1. **Rerun `npm run readme` after all merges**, then commit README.md. On this branch alone the bench block is built from the old `bench/results.json`. I checked the merged state by copying `ui/rebuild`'s `bench/results.json` and `bench/pairs.json` in, running it twice (second run: "up to date"), and putting my files back.
2. **Re-record the GIF after the final merges** (optional): start the server with the demo graph, then `node scripts/record-hero.mjs http://127.0.0.1:8787` (about 15 to 25 s) and commit `docs/blog-assets/conflict.gif`. The committed GIF was recorded from night/n5's dashboard: I extracted that branch with `git archive` into the scratchpad, built it there, and served it with my graph. That run needed no `CAPTION` override and `?play=1` autoplayed, so the script's defaults match N5's UI. The caption card on that run said "caught in 2.2 ms" (a cold first query on a busy machine), so the GIF shows a different number than the README's 0.17 ms internal time. The README says which is which.
3. **Hero copy**: `apps/web/src/landing/HeroGraph.tsx` says "Checked in under 1 ms" (N7's note). The last committed bench median is 1.01 ms because the machine was loaded (load average 29.98). My docs say "about a millisecond" for the round trip and "about 0.2 ms" inside FalkorDB, which hold either way. Rerun `npm run bench` on a quiet machine before the final build.
4. **README `Competitors`, `AI disclosure`, `JUDGE-QA` Q6/Q7/Q12** need your read (see unverified list). Q6 uses the default dogfood answer (no dogfooding beyond one parse). Q12 describes the deployment in the present tense; it is true only after the RUNBOOK has been run.
5. **DEVLOG/STATUS/BLOG-LOG** are not mine. Worth adding: tonight's doc and deploy work; STATUS row B15 still says "median 1 ms" and the old benchmark; the Oct 17 01:22 to 01:31 merges `rebuild/r1` to `r5` (parser, loader, claims, queries, MCP, server, all with Claude Opus 5.5 trailers) rewrote the engine, and DEVLOG only says the engine was kept.
6. **Repo visibility**: `gh repo view` says `PRIVATE`. The checklist needs a public repo; the badge and the uptime workflow need it too. Scheduled workflows run only from the default branch (`main`), so `uptime.yml` must be merged there.
7. **`.gitignore` and `.claude/skills/`**: those files are already tracked (`git ls-files .claude/skills` lists them), so the ignore line stops new ones only. `git rm -r --cached .claude/skills` is your call; I did not run it.
8. **docker-compose.yml** loopback ports (N1) are not applied; RUNBOOK step 1 applies them. `docs/api.md` (not mine) lacks `/api/cypher`, the new health fields and public mode.
9. **Merge N3 (hooks, hub rule)** before the video: DEMO.md relies on claim-on-edit, the multi-line deny and `SessionEnd` release.
10. All servers and graphs I started are gone (see Cleanup).

## Checks (real results)

- `npm run typecheck`: all workspaces exit 0. The root `tsconfig` only includes `*.config.ts`, so I also ran `npx tsc --noEmit --module nodenext --moduleResolution nodenext --target es2023 --strict --skipLibCheck --noUncheckedIndexedAccess --types node scripts/readme-gen.ts`: no errors.
- `npm run lint`: exit 0, no output.
- `SB_TEST_NS=_n4 npx vitest run packages/core/src/queries/claims.test.ts`: 14 passed (includes "ten agents race for the same file: one holder"). `SB_TEST_NS=_n4 npx vitest run scripts/scenario.test.ts`: 2 passed.
- `npm run build -w @switchboard/web`: built (used to serve the GIF run; no web files touched).
- `npm run readme` twice, then `git diff --exit-code README.md`: no diff.
- `grep -c '```cypher' README.md`: 9. The `### Conflict` block equals `npx tsx -e "import('./packages/core/src/queries/conflict.ts').then(m=>console.log(m.conflictQuery(3)))"` (compared after trimming the surrounding newlines).
- Relative links in `README.md` and `docs/DEMO.md`: 17 checked with a grep and `test -e` loop, all resolve (LICENSE, bench/REPORT.md, docs/DEVLOG.md, docs/PLAN.md, docs/blog-assets/conflict.gif, docs/research/SWITCHBOARD-COMPETITORS.md, the six query files and their directory, `../README.md`, `../bench/results.json`, `JUDGE-QA.md`).
- `plutil -lint deploy/*.plist`: both OK. `bash -n deploy/install.sh`: OK. `ruby -ryaml` parses `deploy/cloudflared.yml` and `.github/workflows/uptime.yml`.
- `node scripts/record-hero.mjs http://127.0.0.1:8814` against night/n5's dashboard: `?play=1` autoplayed, the default caption matched, and it wrote `docs/blog-assets/conflict.gif`, 3,683,163 bytes (800 px wide, 83 frames, 6.9 s). I looked at frames at 1.5 s and 5 s: the coach line and idle graph, then the orange path, the blocked agent B card and the caption card with the refusal sentence.
- `grep -nE '\b1 ms|after every merge|three imports|[Tt]hree imports|built with itself|/judge' README.md docs/DEMO.md docs/blog.md docs/JUDGE-QA.md`: no matches. No em dashes in the files I wrote.
- `docs/HACKATHON.md` has no `Sat` left; the deadline reads `Sun Oct 18 11:29 AM PT`.
- Measured for the README: `GRAPH.PROFILE` and `GRAPH.RO_QUERY` on `sb_night_n4`, with N3's final `conflictQuery(3)` (read from the N3 worktree): median 0.17 ms internal over 25 runs, 0.12 to 0.46 ms, while other agents shared the machine. The plan is Union, then per branch `Edge By Index Scan (o)-[c:CLAIMS]->(g:File)` into `Conditional Variable Length Traverse (f)-[:IMPORTS*1..3]->(g)`. Verified facts: 35 `File` nodes, 51 `IMPORTS`, one hub (`lib/utils.ts`, 20 importers), 13 MCP tools, `POST /api/demo` sentence (copied into the README), `check ui/AboutPage.tsx` exits 0 while A holds `session.ts`.
- `node --import tsx apps/server/src/index.ts` (the plist's command line, with the node from `command -v node`) serves `/api/health` on 8814. It was started by hand, not through launchd.

## Facts I could not verify

- The shot list's "ring, packet, caption" is the brief's wording. On night/n5's `/app` I saw the pulse ring on the refused file, the orange path drawing and the caption card; I did not see a separate packet.
- FalkorDB Browser: that it accepts a `CYPHER a=1 ...` prefix (checked only with `redis-cli`), and how it connects to the graph. `GET :3000` returns 200.
- N3's behaviour as the README describes it (claim on edit, multi-line deny with the path, `SessionEnd` release, `demo-repo/` prefix accepted, a warning for unknown files). I read its branch but did not run it. Same for N1's `GET /api/cypher`, `SB_PUBLIC`, `SB_HOST` and N2's replay timing (N2's notes say 6.7 s to replay and 9 s back to live; I did not measure).
- Cursor menu name: DEVLOG B1 says Settings → Tools & MCP, the brief says Settings → MCP; I used the DEVLOG wording. That Claude Code asks for approval of the project MCP server is from the brief.
- The first FalkorDB pull of about 200 MB: the compressed layers of `falkordb/falkordb:latest` for arm64 add up to 185 MiB (`docker manifest inspect`, Oct 17). N1 pins a digest, which may differ.
- Everything in the deploy chain beyond syntax: `install.sh`, the plists under launchd, `cloudflared` with the YAML, `wrangler pages project create switchboard --production-branch main` and `pages deploy` flags (from memory), `launchctl bootout` and `bootstrap` forms, custom domain on Pages, the FileVault and `fdesetup authrestart` remarks, "Bot Fight and Under Attack mode would challenge the API calls". The plist paths (`/Users/bhargavagumpula/.local/node/bin/node`, `/Users/bhargavagumpula/Projects/graph-hacks`) assume the host Mac has the same layout.
- The uptime badge URL (`.../actions/workflows/uptime.yml/badge.svg`) only works once the repo is public and the workflow has run.
- Competitor statements come from `docs/research/SWITCHBOARD-COMPETITORS.md` (Oct 14), not re-read from the projects.
- Which commits came from Cursor and which from Claude Code: only the `Co-Authored-By` trailers say so. The README names both tools and models without counts.
- First-code-commit claim: `aae6dc4` (Oct 14 11:09 PM PT) is the first commit that touches code. Every earlier commit touches only `.md` files, except `37d8364` (Oct 14 10:50 PM), which adds `.cursor/rules/switchboard.mdc`. Checked with `git show --name-only` per commit.
- Own-repo parse "60 files and 81 imports" (Q6) is copied from DEVLOG B4, not rerun.
- Words-per-second budget in DEMO.md (2.5) is an estimate.
- Q12 deployment answer and the README's "Live demo" link describe a deployment that does not exist yet.

## Cleanup

The servers I started on 8814 are stopped (by PID, via `lsof -tiTCP:8814`). Graph `sb_night_n4` is dropped, and `GRAPH.LIST` shows no `_n4` graph. The scratch copy of night/n5 used for the GIF was removed from the scratchpad.

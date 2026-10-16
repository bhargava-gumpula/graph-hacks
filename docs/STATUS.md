# STATUS: live tracker (update at every merge)

States: todo · doing · done · cut. Next up is the first `todo` whose dependencies are done (PLAN §17.5).

| Bundle | Tasks | Model | State | Branch / merge | Notes |
|---|---|---|---|---|---|
| B0 Setup | S1,S2,S4 | Grok 4.7 (S1,S2) + Opus 5.5 (S4, review) | done | `hack/B0` → main | All exit checks green; merged Oct 14 23:2x |
| B1 Day-0 tests | S3,S5 | Opus 5.5 | done | `hack/B1` → main | Both editors hard-block edits and call MCP; Cursor ignores sessionStart context; results in DEVLOG |
| B2 Demo repo | M1 | Grok 4.7 | done | `hack/B2` → main | 35 files, 51 imports, 3-hop login chain, 20-file hub, independent settings island; `demo-repo/expected.json` |
| B3 Core graph | M2,M6 | Grok 4.7 | done | `hack/B3` → main | connect, schema, event bus (20 concurrent writes → seq 1..20), feed, edits; 8 tests |
| B4 Parser+loader | M3,M4 | Opus 5.5 | done | `hack/B4` → main | demo-repo → 35 files, 51 imports, idempotent; `npm run parse -- <dir>` |
| B5 Conflict query | M5 | Opus 5.5 | done | `hack/B5` → main | Q1: A claims crypto.ts, B claims LoginForm → CONFLICT 3-hop UPSTREAM; empty path = OK; Q1 median 0.44 ms |
| B6 MCP+CLI | M7,M8 | Grok 4.7 | done | `hack/B6` → main | MCP `claim` + `switchboard check` exit 2 on 3-hop conflict; 34 tests |
| B7 Server+web shell | M9,M10 | Opus 5.5 | done | `hack/B7` → main | `/api/graph` + SSE; canvas; POST claim LoginForm → 3-hop CONFLICT |
| B8 MVP tag v0.1 + goal check | M11,M12 | Opus 5.5 | done | `hack/B8` → main; tag `v0.1-mvp` | `npm run scenario`: A claims session.ts, B LoginForm → CONFLICT 2-hop path |
| B9 Queries | C1–C5 | Grok 4.7 | done | `hack/B9` → main | brief, why, blast, WCC batches, PageRank hub; 42 tests |
| B10 Tools+CLI | C6,C7 | Grok 4.7 | done | `hack/B10` → main | MCP + CLI: decide, lesson, brief, why, blast, plan, batches, handoff |
| B11 Hooks | C8,C9,(C15) | Grok 4.7 | done | `hack/B11` → main | pre-edit denies a conflicting file; post records the edit; SWITCHBOARD_OFF=1 disables |
| B12 AI summary | F20 | Grok 4.7 | done | `hack/B11` → main | Haiku summary on brief only when ANTHROPIC_API_KEY is set; otherwise the graph text alone |
| B13 Routes+panels | C10–C12 | Grok 4.7 | done | `hack/B11` → main | /api/brief, why, blast, batches, decisions; side panel; click a file for blast |
| B14 Scenario+dogfood | C13,C14 | Grok 4.7 | done | `hack/B11` → main | scenario prints batches and the argon2 why-trace; rules say claim first |
| B15 Benchmark | F23 | Grok 4.7 | done | `hack/ship` → main | 10/10 builds broke without the check, 0/10 when it blocked the edit; median 1 ms |
| B16 Core tag v0.2 + goal check | C16 | Grok 4.7 | done | tag `v0.2-core` | goal check in DEVLOG |
| B17 Mockups | V0 | — | cut | | the live dark page is the direction; three throwaway mockups were not made |
| B18 Visual polish | V1–V7 | Grok 4.7 | done | `hack/ship` → main | story bar, landing, judge page. No path animation |
| B19 Landing+judge | F24,V8,V9 | Grok 4.7 | done | `hack/ship` → main | `/` reads bench/results.json; `/judge` runs Conflict, Batches, Why |
| B20 Polish tag | V10 | — | cut | | no separate polish tag; `v0.2-core` is the snapshot |
| B21 Deploy | D1,D2 | Grok 4.7 | done | `deploy/RUNBOOK.md` | runbook only. No public URL until the owner starts cloudflared |
| B22 Docs/README | D3,D4 | Grok 4.7 | done | README, `docs/DEMO.md` | setup, model, queries, benchmark, AI disclosure |
| B23 Blog | D5 | Grok 4.7 | done | `docs/blog.md` | draft, not published |
| B24 Video+submit v1.0 | D6,D7 | owner | todo | | owner records from `docs/DEMO.md` and submits |

## Goal checks (PLAN §17.8)
| When | Graph essential | Track fit | Differentiation | Demo runs | Proof | Owner can explain | On schedule | Drift | Actions |
|---|---|---|---|---|---|---|---|---|---|
| B8 `v0.1-mvp` 2026-10-15 16:25 PT | yes | partial | yes | beats 1–2 | yes | yes | yes (ahead of Fri 10 AM) | small, goal-serving | P2 next: briefing, why, WCC, hubs, hooks |

## Later ideas (not in the current phase)
- `npm run db:ping` fails inside a worktree (compose project name differs). Workaround: `COMPOSE_PROJECT_NAME=graph-hacks npm run db:ping`. Fix by adding a top-level `name:` to docker-compose.yml when nothing is running.


# Dashboard (`/app`): design spec (2026-10-17)

**Job:** let a judge (or an agent operator) *see* coordination happening live on the FalkorDB graph, and *try it* without a terminal.
**Design read:** a live product canvas for technical judges, in the same dark, graph-first language as the landing page. Signal orange is the only accent, reserved for conflicts and the primary action. Geist and Geist Mono. Density 6, motion 6, and motion is only used for state changes (motion-doctrine: no idle wobble).

## Layout (desktop ≥1280)
```
┌ Top bar 56px: mark · Switchboard · graph name · ● live · seq 214 ·········· [Try a claim] [Play the demo] ┐
├ Agents 280px ─────┬ Graph canvas (fills) ───────────────────────────────┬ Side panel 380px ───────────────┤
│ A  active  ⟳ 2s   │ folder columns, files as nodes, imports as curves  │ Tabs: Feed · Inspect · Decisions │
│  task  t-session  │ claims = rings + agent letter                      │        · Brief                   │
│  ▢ crypto.ts 4:12 │ conflict = orange packet travels the path          │ Feed: live events, conflict rows │
│ B  active         │ batches mode: tasks tinted by parallel batch       │   pinned in orange, click → path │
│  ...              │ pan (drag) · zoom (wheel) · fit                    │ Inspect: selected file: claimed  │
│                   │ hover → card (path, claimed by, importers, hub)    │   by, blast radius by hop, why   │
│                   │                                                    │   trace, Cypher drawer           │
└───────────────────┴────────────────────────────────────────────────────┴──────────────────────────────────┘
```
Below 1280px the panels become drawers. Below 768px the layout is a stack: canvas, then tabs.

## Interactions
- **Play the demo:** `POST /api/demo`. Events stream in over SSE, and each one animates on the canvas (claim ring lands, conflict packet, impact, refusal toast).
- **Try a claim (judge playground):** pick an agent and a file, then `POST /api/claims`. The result shows inline: OK, or CONFLICT with the path drawn.
- **Click a file:** the Inspect tab opens: blast radius (`/api/blast`), with dependents lit by hop (1 bright, 2 mid, 3 faint), and the why-trace (`/api/why`).
- **Batches toggle:** `/api/batches` colours tasks' files by component (neutral shades plus labels; no second accent).
- **Brief tab:** `/api/brief?task=` gives the brief text, plus the AI summary when the key is set.
- **Cypher drawer:** the named query behind the last answer, for judge trust (rule 12).

## States
Loading uses skeletons shaped like the panels. Empty: "No agents yet. Press Play the demo." Error: an inline banner if `/api/health` fails, with a retry. SSE reconnects automatically (with `Last-Event-ID`).

## Build order
1. `useLive` data hook (snapshot + SSE + refetch)
2. Layout shell + top bar
3. Graph canvas (layout, pan/zoom, hover, select)
4. Feed + conflict animation
5. Inspect (blast + why + Cypher)
6. Agents panel
7. Try-a-claim
8. Decisions + Brief
9. Batches mode
10. Polish + review

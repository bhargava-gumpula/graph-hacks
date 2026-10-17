# Night N6: landing shell (mobile overflow, ASCII perf and calm, Breakdown, truthful Query, share cards)

Branch `night/n6` off `ui/rebuild`. Server for checks: `SERVER_PORT=8816 SB_GRAPH=sb_night_n6` (the orchestrator assigned 8816; the brief said 8796).

## What changed, in brief order
1. **Hero**: the splitText/animate effect runs in `useLayoutEffect` with an explicit start state (`utils.set(words, {y: "105%", opacity: 0})`), so the unsplit headline never paints. h1 is now "Coding agents can't see each other." with the muted "Switchboard can." The `/app` CTAs in Hero and Closing go to `/app?play=1`.
2. **No sideways scroll at 375**: Query's first grid child has `min-w-0`; Breakdown plate labels are `hidden sm:block` and the stack is `scale-[0.82] sm:scale-100 origin-center`; the Landing root has `overflow-x-clip`.
3. **AsciiField perf**: 6 neutral alpha buckets plus 3 hot (orange) buckets. Each (row, bucket) is one space-padded `fillText`, drawn bucket-major (fillStyle/globalAlpha set once per bucket): about 400 calls per frame instead of about 10.5k. The field's static radial term is cached per cell; the column, row and diagonal sines are computed once per frame. 20 fps on a fixed cadence (a late frame doesn't push later ones back), 10 fps once the pointer has been still for 2 s with no pulses, DPR capped at 1.5. The pointer distance is only computed while the pointer is on the page and near the row.
4. **AsciiField calm**: the resting field only reaches ` .·:-`; `+*%#@` come only from pointer or pulse energy. Pointer boost 0.25, radius 140. Canvas: `lg:` mask gradient, `opacity-60` below lg. `pulse()` and the component API are unchanged.
5. **Breakdown**: every plate has real SVG content (plate-space coordinates shared across plates):
   - Code graph: 8 files, IMPORTS curves, the B-to-A conflict path in orange, and a dashed "PageRank hub" the path avoids.
   - Claims: orange rings A and B, `:CLAIMS {until}`.
   - Memory: Decision / Lesson / Event chips tagged semantic / procedural / episodic, and SUPERSEDES to an older Decision.
   - Agents: A and B WORKS_ON a Task.
   - Dashed guides drop from each claim ring straight down to its file dot. They are counter-rotated (`rotateZ(38deg) rotateX(-58deg)`) so they stay screen-vertical, and they follow the scroll spread and the hover lift.
   - Hovering a plate or a row (or focusing a row) lifts that plate 14 px with an orange border and swaps the row body to its capability in mono. Agents: WCC over INTERFERES. Claims: brief_me. Memory: why(path). Code graph: PageRank.
   - Reduced motion: static full spread, no fades, instant lift.
6. **Query**: the code block is the real `conflictQuery(3)` (SAME / UPSTREAM / DOWNSTREAM UNION ALL) with `none(n IN nodes(p)[1..-1] WHERE coalesce(n.hub, false))`, re-wrapped at existing spaces only. Repeated clauses share a note and highlight together. The hub copy is as briefed. The note is sticky beside the code on lg and above it on phones. `CYPHER` is exported for the check below.
7. **theme.css**: `--signal-text` is #ff6a3d (dark) and **#bf4219** (light). It is used for orange text in my files; fills and strokes keep `--color-signal`.
8. **Share cards** (index.html): og:type/site_name/title/description/url/image (+ size, alt), twitter:card=summary_large_image/title/description/image, theme-color #0b0b0d, and `<link rel="icon" href="/favicon.svg">`. The favicon is the Nav mark and follows the tab's color scheme. og.png is 1200x630 of `/` at 6 s.
9. **Closing**: two columns on lg. The right half is a framed `public/app-conflict.png` (1440x900 of /app about 3 s after POST /api/demo) linking to `/app?play=1`, with a hover lift and the caption. It stacks under the CTAs on phones. `VIDEO_URL` and `WRITEUP_URL` are empty, so those links don't render.
10. **Nav**: no /judge link (there was none).

## Deviations from the brief
- **Hot buckets**: 3 instead of 1, to keep the shockwave's fade. Pulses are rare and short, so the cost is negligible.
- **Resting field**: uses `round(level * 0.5)` capped at '-' instead of `floor(level * 0.45)`, with brighter neutral alpha steps (0.12 to 0.45). The briefed numbers left a near-invisible dot grid, and the owner asked for the field to stay clearly visible and alive. Still no `+*%#@` without pointer or pulse.
- **Light `--signal-text`**: #bf4219, not #c8461c. #c8461c is 4.47:1 on the light page background #f6f6f7 (fails AA). #bf4219 is 4.85:1 there and 5.24:1 on white.
- **Breakdown look**:
  - Plates are translucent (surface 40%, 75% when hovered) so lower layers read through.
  - The Code graph plate is no longer orange-tinted; orange is kept for claims, the conflict path and the guides.
  - Spread 74 -> 80 px, container 420 -> 440 px, `xl:scale-110`.
- **Primary hero CTA**: "See it catch one" still scrolls to `#story`. Only the `/app` links changed. The Nav "Live graph" link is still `/app` (not in scope).
- **Domain placeholder**: crawlers need absolute URLs, so `https://switchboard.bhargava-gumpula.com` appears in og:url, og:image and twitter:image. A comment names it once; one find-and-replace swaps it.

## For the orchestrator
- Swap the domain: replace `https://switchboard.bhargava-gumpula.com` in `apps/web/index.html` (3 attributes and the comment).
- Recapture after the dashboard merge:
  - `node scripts/shot.mjs http://localhost:<port>/ apps/web/public/og.png 1200 630 0 6000`
  - `curl -X POST localhost:<port>/api/demo && node scripts/shot.mjs http://localhost:<port>/app apps/web/public/app-conflict.png 1440 900 0 3000`
  - The current app-conflict.png shows `sb_night_n6` in the header.
- Restart the server after each web rebuild: its SPA fallback caches index.html in memory, so /app keeps old asset hashes.
- Fill `VIDEO_URL` / `WRITEUP_URL` in `apps/web/src/landing/Closing.tsx` when they exist.
- Optional: point the Nav "Live graph" link at `/app?play=1`.
- Re-check the Query text after N3's conflict.ts lands. The replaceAll is a no-op once core has `[1..-1]`:
  `npx tsx -e 'import { conflictQuery } from "./packages/core/src/queries/conflict.ts"; import { CYPHER } from "./apps/web/src/landing/Query.tsx"; const n = (s) => s.replace(/\s+/g, " ").trim(); const core = conflictQuery(3).replaceAll("none(n IN nodes(p) WHERE", "none(n IN nodes(p)[1..-1] WHERE"); console.log(n(core) === n(CYPHER) ? "same" : "DIFF")'`
- At 375, two elements still poke past the viewport but are clipped by `overflow-x-clip`, so there is no scroll. One is Compare's `li` (`x: 24`, N8's file); the other is a muted span, not traced.

## Checks (real results, 2026-10-17 ~02:45 PT)
- `npm run typecheck`: exit 0. `npm run lint`: exit 0 (eslint ignores apps/web). `npm run build -w @switchboard/web`: built in 4.9 s, exit 0.
- No unit tests cover apps/web, and core is untouched, so no vitest run was needed.
- **Cypher**: Query.tsx `CYPHER` vs `conflictQuery(3)` with the interior-hub filter. Whitespace-normalized strings are equal, and a token-per-line `diff` shows no differences.
- **375x812** (Playwright, isMobile): `scrollWidth` 375 = `innerWidth` 375. Query h2 and paragraph span x 20 to 355.
- **1440**: `scrollWidth` 1440.
- **Share cards**: `curl -s localhost:8816/ | grep -c 'og:'` = 10. `/favicon.svg` 200 (image/svg+xml), `/og.png` 200, `/app-conflict.png` 200.
- **Hero first frame**: a MutationObserver sees the h1 already split, every word at opacity 0 / translateY(105%). The only opacity-1 span is anime's clipped screen-reader copy.

### Perf
Playwright, 1440x900, DPR 2, headless Chromium, `/` after the hero settles. Busy = ΔTaskDuration / Δt from CDP `Performance.getMetrics`. Draws/s = AsciiField `clearRect` calls.

| | busy before | busy after | ASCII fps before | ASCII fps after |
|---|---|---|---|---|
| idle 5 s, pointer off page | 31.8% | 7.8% / 8.0% (two runs) | 22.6 | 10.0 |
| pointer moving, 1x | 31.6% | 16.5% | 22.4 | 20.0 |
| pointer moving, 4x CPU throttle | 99.8% | 64.3% / 72.2% | 14.6 | 20.0 (frame gap p50 50 ms, p90 56 ms) |

The brief's 61% idle figure came from a real browser; headless measured 31.8% before. Busy includes HeroGraph and the rest of the page.

## Screenshots
Scratchpad `.../scratchpad/night/n6/`:
- `hero-100ms.png`, `hero-6s.png`
- `full-1440.png`, `full-375.png`
- `hero-light.png`
- `breakdown-hover.png` (Code graph row hovered), `bd-zoom-claims.png` (Claims hovered, 2x)
- `breakdown-reduced.png`
- `query-1440.png`, `query-375.png`
- `closing-1440.png`, `closing-375.png`

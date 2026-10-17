# night-n8: landing story (session.ts, 2 hops), deterministic scroll, story beats, hero reveal

Branch `night/n8`. Files touched: `apps/web/src/landing/{HeroGraph,StoryGraph,Story,Compare}.tsx`, `apps/web/src/landing/graphLayout.ts`, this file.

## What changed
1. **One story.** `CONFLICT_PATH` is now `ui/LoginForm.tsx -> api/login.ts -> auth/session.ts`, with `HELD` and `WANTED` exported from `graphLayout.ts`. The hero, Story and Compare all say session.ts and "two imports". The hero caption reads `bench.checkMsMedian` from `bench/results.json`, the same way Proof.tsx does, so the hero and Proof can't disagree. Compare's entry is now `{y: 16}` (it was `{x: 24}`, which overflowed on phones).
2. **Hero timing.** `useInView` gates the beats. A figure that is waiting draws nothing (step -1). The story plays when the reader sees it, plays again on re-entry, and replays 14 s after the verdict while it stays in view. The verdict slot reserves its height on phones (`min-h-[5.25rem]`) so it causes no layout shift.
3. **Labels.** Folder labels sit at `y = H - 8`. ui/ labels go above and to the left of the node (`x - 14, y - 13`). The middle hop's label goes above its node. The claimed file's label is offset 22. Orange text uses `var(--signal-text, var(--color-signal))`.
4. **Scroll stages.** `useScroll({target: sectionRef, offset: ['start start','end end']})` plus `useMotionValueEvent(... floor(v*4))`. The step spacing is set so each quarter of the scroll range is exactly one step, which keeps the text in sync with the graph (formulas are in the Story.tsx doc comment):
   - lg: steps are `75vh`, padding is `54vh` top and `46vh` bottom, and each step is centred at its stage's midpoint.
   - below lg: steps are `34vh`, top padding is `calc(86vh - 75vw - 94px)` (`-76px` from md), bottom padding is `14vh`. The active heading moves from 86vh to 52vh, always under the pinned graph.
5. **Story beats.**
   - Stage 0: two dashed worktree frames ("B's view" / "A's view") sit ±36 apart on one shared spring, with fog in the gap and the cross-gap edges hidden.
   - Stage 1: the halves spring together and the chain draws in.
   - Stage 2: the chain turns solid fg and the AsciiField pulses at LoginForm.
   - Stage 3: A's ring lands. 0.65 s later B's claim packet travels the route (the shared `route()` / `travel()` helpers in graphLayout.ts, also used by HeroGraph). Then the impact ring and `pulse()` at session.ts fire, B's chip shakes to "edit refused", there is 0.55 s of stillness, and the mono result card fades in: `CONFLICT · UPSTREAM · 2 hops · held by A · 0.65 ms`.
   - Under the graph, a fixed-height mono readout says what each stage shows: the two files, the chain, the tsc failure, then the result card.
6. **Hero hover reveal.** An HTML card is placed over the SVG using `x/W`, `y/H` percentages, with AnimatePresence.
   - Path nodes: `hop n of 2`, who imports them, and `-[:IMPORTS*1..3]->`.
   - session.ts: Claimed by Agent A, until +30 min, intent: rewrite the session label.
   - utils.ts: hub (PageRank), paths don't pass through it.
   - Other nodes: their importer count.
   - Path nodes have `tabIndex=0`. Focus shows the card and a ring, and the node has an `aria-label` with the same text. The SVG role changed from `img` to `group` because it now has focusable children.

## Deviations from the brief
- **Hero in-view:** `useInView` observes the SVG wrapper with `amount: 0.45, margin: '0px 0px -20% 0px'`, not the figure with `amount: 0.5`. At 375x812 the figure is already 72% visible at load, so `0.5` started the animation with the verdict below the fold. This version waits until the reader scrolls to it, and still starts at once on desktop.
- **Mobile step alignment:** the li's use `items-start` plus the computed padding above, not `items-end pb-[14vh]`. With 70vh li's and `items-end`, stage 3 activated while its text was still below the fold, and stage 0's heading slid under the graph. Now the active heading clears the graph through the whole of every stage (measured below).
- **Story agent chips:** these are SVG, so they are hidden below `sm`, where 12px SVG text renders at about 6px. On phones the readout line and the larger node labels (22 SVG units, about 11.5px) carry that information.
- The Story pulse calls moved from Story.tsx into StoryGraph.tsx, which knows the node coordinates. Stage 3 now pulses on impact rather than on stage entry.

## For the orchestrator
- **Incident:** earlier tonight I restarted my server with `pkill -f "apps/server/src/index.ts"`, about 4 times between 02:15 and 02:26. That pattern also matches the public demo server on :8787 and the other packages' servers. It was probably why the demo server went down (it was restarted at 02:26:21). Once I got the process rule I stopped my server by port only (`lsof -tiTCP:8818 -sTCP:LISTEN | xargs kill`). :8787 was up when I finished.
- `--signal-text` is not defined in theme.css yet (N6 owns that file). Everything falls back to `--color-signal`.
- Nothing else is needed outside my files.

## Checks (real results)
- `npm run typecheck`: all workspaces pass, no errors.
- `npm run lint`: clean (apps/web is in the eslint ignore list).
- `npm run build -w @switchboard/web`: built. The only warnings are the existing "use client" directive warnings.
- `grep -nE 'crypto\.ts|[Tt]hree imports' apps/web/src/landing/{HeroGraph,StoryGraph,Story,Compare}.tsx`: no hits.
- Playwright (scratchpad `night/n8/verify.mjs`, server :8818, graph `sb_night_n8`), at 1440x900 and 375x812, normal and reduced motion:
  - Every stage at the midpoint of its quarter, and at 2% and 98% into each quarter: active step = `floor(progress*4)` in every case.
  - 375: the active heading never overlaps the pinned graph. Its top stays between 428 and 768 px, and the graph's bottom is at 407.
  - Fast jump from the top to the end of the section gives stage 3, with the result card shown.
  - End gives stage 3 (progress 1.000), Home gives stage 0 (0.000), and the middle gives stage 2 (0.504 / 0.509).
  - 375 hero: no verdict at load. The verdict shows after scrolling the graph into view.
  - Hover cards for LoginForm.tsx, session.ts and utils.ts are correct at both sizes. Tab focuses LoginForm.tsx and shows its card.
  - Hero re-entry restarts the story. Auto-replay runs 14 s after the verdict.
  - No page or console errors in any run, including reduced motion.

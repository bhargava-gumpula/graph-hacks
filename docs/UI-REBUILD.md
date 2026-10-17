# UI rebuild (owner decision, 2026-10-17, 12:35 AM PT)

**Decision:** keep the tested engine (FalkorDB graph, queries, MCP, CLI, hooks, benchmark, server API). **Rebuild the whole UI/UX from scratch**, following docs/UI-REELS.md and the `design-taste-frontend` skill. The old UI is preserved at tags `archive/cursor-v1` and `archive/cursor-v1-ui-reels`.

**Deadline:** Sun Oct 18, 11:29 AM PT. Internal: submit by 10:30 AM.

**Design read:** a developer-tool landing page and product canvas for technical judges, in a dark, precise, graph-native language. Built on Vite + React, Tailwind v4, Motion (`motion/react`) for UI and GSAP ScrollTrigger for the storyline, Phosphor icons, Geist + Geist Mono.
**Dials:** DESIGN_VARIANCE 7 · MOTION_INTENSITY 7 · VISUAL_DENSITY 4.
**Palette:** zinc neutrals plus **one accent: signal orange `#ff6a3d`**, used for the conflict path, the primary CTA and benchmark highlights. Safe/OK states use neutral white, never a second accent. One radius system: 10px for panels, full pill for buttons and chips.

## Phases
| Phase | Window (PT) | Scope | Exit |
|---|---|---|---|
| **U1 Foundation + hero** | Sat 1–5 AM | Tailwind v4 + tokens + fonts + Motion/GSAP/Phosphor; routes `/` landing, `/app`, `/judge`; the **hero: a live, code-drawn graph animation** of two agents colliding through a dependency path (no static image) | `npm run build` passes, hero screenshot reviewed |
| **U2 Landing storyline** | Sat 5 AM–1 PM | Scroll-based storyline: problem → hidden dependency → collision → the graph catches it (real conflict path) → **object breakdown** of the layers (code graph · claims · memory · agents) → **benchmark** (animated numbers from `bench/results.json`) → competitors → try it / links | the whole page scrolls smoothly, reduced motion works, mobile collapses |
| **U3 Product app** | Sat 1–7 PM | `/app` canvas restyle (Sigma), hover reveal (agent, claim, Cypher), conflict path draw animation, panels (agents, feed, decisions, briefing + AI summary), `/judge` 3-button page | live demo (`/api/demo`) plays end to end in the new UI |
| **U4 Polish + review** | Sat 7–10 PM | `web-design-guidelines` + taste pre-flight, a11y, responsive, OG image (Satori-style), copy audit, screenshots → **freeze 10 PM** | tag `v0.4-ui` |
| Ship | Sat 10 PM → Sun 10:30 AM | deploy (cloudflared), README update, video (owner's voice), blog, submit | submitted |

Goal check (PLAN §17.8) at the end of each phase. Log to DEVLOG and BLOG-LOG as we go.

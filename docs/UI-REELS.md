# UI/UX reels: required guidance for the UI rebuild (owner, 2026-10-17)

The owner requires that the UI/UX rebuild use the skills, tools and guidance from these reels. The extracted findings are added below once read.

**Group 1**
- https://www.instagram.com/reel/DeZ3P_8NeHT/
- https://www.instagram.com/reel/DeiEC-fvGvF/
- https://www.instagram.com/reel/DbL96sdolN8/
- https://www.instagram.com/reel/DefMW04DAay/
- https://www.instagram.com/reel/DdRo-ZIRWJ9/

**Group 2 (new)**
- https://www.instagram.com/reel/Dei6J0AvlXw/
- https://www.instagram.com/reel/DekDeonAy9l/

**Group 3 (newest)**
- https://www.instagram.com/reel/DafwK7pKVDC/
- https://www.instagram.com/reel/DZ6RKjtxbvk/


### What each reel teaches (read 2026-10-17 from captions and video frames)
| Reel | Creator | What it gives us |
|---|---|---|
| DeZ3P_8NeHT | buck.the.aikami | **Code-drawn animation with Claude** (a custom skill, `motion-studio-by-buck`, gated). Method: pick a reference style you love → Opus 5.5 at high effort + references → the skill plans beats (a time/picture/sound table), renders frames *in code*, self-checks, stitches the MP4. Lesson: **code places, it doesn't predict.** Use precise, code-driven animation (SVG/canvas) and keep one consistent style across every shot. |
| DeiEC-fvGvF | josephbchandler | **"Shared AI brain"**: one memory shared by Claude, Codex and Hermes (tools: Memory, Hermes, Composio), run locally. ⚠️ Adjacent to Switchboard's pitch: our edge stays the **code dependency graph + conflict prevention**, not just shared memory. Visual language: dark, soft violet glow icons, gauges, simple app tiles. |
| DbL96sdolN8 | felixbravoai | **5 websites for better AI-built UIs:** (1) **anime.js**, "the complete animator's toolbox"; (2) **Motion** (motion.dev): independent transforms, scroll animation, gestures, layout animation, spring physics, exit animation, timelines; (3) **Kokonut UI**: 100+ animated React + Tailwind components (card flip, stack, Apple activity card); (4) an animated **charts/dashboard library** with a backlit dark look (the S-logo site: Docs, Components, Blocks, Showcase, Charts, Studio); (5) **Manus**, an AI agent that builds sites. |
| DefMW04DAay | msbintel | **20 repos for Claude motion graphics ("a full motion studio"):** Remotion, Remotion Skills, Motion Canvas, GSAP, Anime.js, Rive, Three.js, React Three Fiber, Satori (title cards / OG images), FFmpeg. No editor, just typing. |
| DdRo-ZIRWJ9 | seanaiux | **Elements that make a site worth $30k+:** **scroll-based storyline**, **smooth animations**, **hero video**, **hover-based reveal**, **object breakdown** (an exploded view of a product). "The more seamless and immersive the experience, the higher the price." |
| Dei6J0AvlXw | buildwithbyron | Many animation styles Claude can produce for you (no video was available; caption only). |
| DekDeonAy9l | ahmed_fx3000 | Motion design made in After Effects, Premiere Pro and Blender. A reference for cinematic quality and pacing. |
| DafwK7pKVDC | seanaiux | Premium site animations built in **Framer or Webflow** with small custom-coded components (by @ubernatural.io). The bar for polish. |
| DZ6RKjtxbvk | jerrythewebdev | **Taste over tools:** AI generates possibilities; the craft is choosing, removing, pacing and directing the eye. "Every decision feels deliberate. The movement has purpose. The spacing creates tension. The experience knows where to lead you next." Restraint. |

### Rules for the Switchboard UI (derived from the reels)
1. **Direction before generation.** Pick one reference style and hold it across the landing page, app, video and OG image. Remove anything that doesn't serve the story (jerrythewebdev).
2. **The landing page is a scroll-based storyline** (seanaiux): two agents → the hidden dependency → the collision → the graph catches it → how it works → proof (benchmark) → try it.
3. **The hero is a moving piece, not a static image:** a live, code-driven graph animation (our "hero video"), drawn in code so it's crisp and exact (buck's lesson).
4. **Object breakdown:** an exploded view of Switchboard's layers (code graph · claims · memory · agents) that separates on scroll.
5. **Hover-based reveal:** hovering a node or path reveals the agent, the claim and the Cypher behind it.
6. **Motion with purpose:** use Motion (motion.dev) for layout, springs and exits; GSAP ScrollTrigger (or Motion scroll) for the storyline; anime.js or SVG for path drawing. Every animation points the eye at the next thing; respect `prefers-reduced-motion`.
7. **Components:** start from Kokonut UI / shadcn-style animated components and restyle them to our tokens. Charts and benchmark numbers get a dark, backlit look with animated counters.
8. **Assets:** Satori for OG and title cards; Remotion is optional, for the demo video's title cards.
9. **Spacing creates tension:** generous whitespace, a strict type scale and one accent colour.
10. **Review pass:** run the `web-design-guidelines` and `design-taste-frontend` skills before freeze.

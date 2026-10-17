import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { StoryGraph } from "./StoryGraph";

const STEPS = [
  {
    title: "Two agents, two clean worktrees.",
    body: "Agent A rewrites the session label in session.ts. Agent B polishes the login form. Different files, different branches. Nothing looks wrong.",
  },
  {
    title: "Two imports apart.",
    body: "LoginForm.tsx imports login.ts, which imports session.ts. Neither agent can see that chain from its own worktree.",
  },
  {
    title: "Without a check, git merges both.",
    body: "Each branch passes on its own. Merged together, the login form calls code that A changed under it, and the build breaks.",
  },
  {
    title: "With Switchboard, B asks first.",
    body: "B claims LoginForm.tsx. One graph query finds the path to A's claim and refuses the edit, with the chain as the reason.",
  },
];

/**
 * Scroll-based storyline: the graph stays pinned while the steps scroll by, and the stage is read
 * straight from the section's scroll progress, so anchor jumps, End/Home and fast flings always land
 * on the right stage. The spacing is chosen so each quarter of the scroll range is exactly one step:
 * - lg: steps are 75vh tall and the list pads 54vh + 46vh = one viewport, so a step is centred at its stage's midpoint.
 * - below lg: the pinned graph block is 75vw + 94px tall (75vw + 76px from md), the top padding brings
 *   each heading in at 86vh, and steps are 34vh, so the active heading moves from 86vh to 52vh, under the graph.
 */
export function Story() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setStage(Math.min(3, Math.floor(v * 4))));

  return (
    <section
      ref={sectionRef}
      id="story"
      className="relative mx-auto max-w-7xl px-5 md:px-8"
      aria-label="How a collision happens"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="sticky top-16 z-10 order-first -mx-5 bg-[var(--bg)]/90 px-5 py-4 backdrop-blur-sm md:-mx-8 md:px-8 max-lg:after:pointer-events-none max-lg:after:absolute max-lg:after:inset-x-0 max-lg:after:top-full max-lg:after:h-16 max-lg:after:bg-gradient-to-b max-lg:after:from-[var(--bg)] max-lg:after:to-transparent lg:order-last lg:mx-0 lg:flex lg:h-[calc(100dvh-4rem)] lg:items-center lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="w-full">
            <StoryGraph stage={stage} />
          </div>
        </div>
        <ol className="pb-[14vh] pt-[max(0px,calc(86vh_-_75vw_-_94px))] md:pt-[max(0px,calc(86vh_-_75vw_-_76px))] lg:pb-[46vh] lg:pt-[54vh]">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex min-h-[34vh] items-start lg:min-h-[75vh] lg:items-center">
              <motion.div
                initial={false}
                animate={{ opacity: reduce || stage === i ? 1 : 0.28 }}
                transition={{ duration: reduce ? 0 : 0.4 }}
                className="max-w-md"
                aria-current={stage === i ? "step" : undefined}
              >
                <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{s.title}</h2>
                <p className="mt-4 text-pretty text-base leading-relaxed text-[var(--muted)] md:text-lg">{s.body}</p>
              </motion.div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

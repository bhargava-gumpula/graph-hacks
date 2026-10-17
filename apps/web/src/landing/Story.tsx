import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { StoryGraph } from "./StoryGraph";

const STEPS = [
  {
    title: "Two agents, two clean worktrees.",
    body: "Agent A rewrites the hashing in crypto.ts. Agent B polishes the login form. Different files, different branches. Nothing looks wrong.",
  },
  {
    title: "Three imports apart.",
    body: "LoginForm.tsx imports login.ts, which imports session.ts, which imports crypto.ts. Neither agent can see that chain from its own folder.",
  },
  {
    title: "Without a check, git merges both.",
    body: "Each branch passes on its own. Merged together, the login form calls a function that no longer exists, and the build breaks.",
  },
  {
    title: "With Switchboard, B asks first.",
    body: "B claims LoginForm.tsx. One graph query finds the path to A's claim and refuses the edit, with the chain as the reason.",
  },
];

/** Scroll-based storyline: the text steps scroll by while the graph stays pinned; the step in the middle band sets the stage. */
export function Story() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);

  return (
    <section id="story" className="relative mx-auto max-w-7xl px-5 md:px-8" aria-label="How a collision happens">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="sticky top-16 z-10 order-first -mx-5 bg-[var(--bg)]/90 px-5 py-4 backdrop-blur-sm lg:order-last lg:mx-0 lg:flex lg:h-[calc(100dvh-4rem)] lg:items-center lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="w-full">
            <StoryGraph stage={stage} />
          </div>
        </div>
        <ol className="lg:pt-[18vh] lg:pb-[8vh]">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex min-h-[70vh] items-center lg:min-h-[85vh]">
              <motion.div
                onViewportEnter={() => setStage(i)}
                viewport={{ amount: 0.9, margin: "-30% 0px -30% 0px" }}
                animate={{ opacity: reduce || stage === i ? 1 : 0.28 }}
                transition={{ duration: 0.4 }}
                className="max-w-md"
              >
                <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{s.title}</h2>
                <p className="mt-4 text-lg leading-relaxed text-[var(--muted)]">{s.body}</p>
              </motion.div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

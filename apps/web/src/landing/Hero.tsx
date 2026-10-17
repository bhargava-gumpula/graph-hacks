import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { animate, splitText, stagger } from "animejs";
import { ArrowRight } from "@phosphor-icons/react";
import { HeroGraph } from "./HeroGraph";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const h1 = useRef<HTMLHeadingElement>(null);

  // Waterfall entry (cut-the-curve §6): words rise from below a clipped line, staggered, with anime.js.
  useEffect(() => {
    if (reduce || !h1.current) return;
    const split = splitText(h1.current, { words: { wrap: "clip" } });
    const a = animate(split.words, {
      y: ["105%", "0%"],
      opacity: [0, 1],
      duration: 900,
      delay: stagger(70, { start: 150 }),
      ease: "outExpo",
    });
    return () => {
      a.revert();
      split.revert();
    };
  }, [reduce]);

  const rise = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: EASE } };

  return (
    <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-10 px-5 pb-16 pt-12 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6 lg:pt-16">
      <div className="max-w-xl">
        <h1 ref={h1} className="text-4xl font-semibold leading-[1.05] tracking-tighter md:text-5xl lg:text-6xl">
          Agents can't see each other. <span className="text-[var(--muted)]">Switchboard can.</span>
        </h1>
        <motion.p {...rise(0.12)} className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[var(--muted)]">
          One FalkorDB graph checks every edit against your code's real dependencies, and stops two agents before they collide.
        </motion.p>
        <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center gap-3">
          <a
            href="#story"
            className="group inline-flex items-center gap-2 rounded-full bg-[var(--color-signal)] px-5 py-3 text-sm font-medium text-[#1a0d08] transition active:scale-[0.98]"
          >
            See it catch one
            <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="/app"
            className="inline-flex items-center rounded-full border border-[var(--border)] px-5 py-3 text-sm font-medium transition hover:border-[var(--muted)] active:scale-[0.98]"
          >
            Open the live graph
          </a>
        </motion.div>
      </div>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.1, ease: EASE }}
        className="relative"
      >
        <HeroGraph />
      </motion.div>
    </section>
  );
}

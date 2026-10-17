import { ArrowUpRight } from "@phosphor-icons/react";
import { REPO_URL } from "./Nav";

/** Fill these in when they exist; each link renders only when its URL is set. */
const VIDEO_URL = "";
const WRITEUP_URL = "";

export function Closing() {
  const ghost =
    "inline-flex items-center rounded-full border border-[var(--border)] px-5 py-3 text-sm font-medium transition-[scale,border-color] duration-150 ease-snap hover:border-[var(--muted)] active:scale-[0.98]";
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
        <div>
          <h2 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tighter md:text-6xl lg:text-5xl">
            Watch two agents collide, then watch the graph stop them.
          </h2>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/app?play=1"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-signal)] px-5 py-3 text-sm font-medium text-[#1a0d08] transition-[scale,filter] duration-150 ease-snap hover:brightness-110 active:scale-[0.98]"
            >
              Open the live graph
              <ArrowUpRight size={16} weight="bold" />
            </a>
            <a href={REPO_URL} className={ghost}>
              Read the source
            </a>
            {VIDEO_URL && (
              <a href={VIDEO_URL} className={ghost}>
                Watch the 2-min video
              </a>
            )}
            {WRITEUP_URL && (
              <a href={WRITEUP_URL} className={ghost}>
                Read the write-up
              </a>
            )}
          </div>
        </div>
        <figure className="min-w-0">
          <a
            href="/app?play=1"
            className="group block overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] transition-[translate,border-color] duration-200 ease-snap hover:border-[var(--muted)] motion-safe:hover:-translate-y-1"
          >
            <img
              src="/app-conflict.png"
              width={1440}
              height={900}
              loading="lazy"
              decoding="async"
              alt="The Switchboard live dashboard: two agents, their claims, and a refused edit with its import path drawn in orange."
              className="block h-auto w-full"
            />
          </a>
          <figcaption className="mt-4 text-sm text-[var(--muted)]">
            The live dashboard: claims, conflicts and the path, streamed from FalkorDB
          </figcaption>
        </figure>
      </section>
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between md:px-8">
          <p>Built for Graph Hacks with FalkorDB. Tracks: Agent Memory and Coordination, Agents That Act on Connected Data.</p>
          <p>Built with AI coding assistants, directed and reviewed by a human. Details in the README.</p>
        </div>
      </footer>
    </>
  );
}

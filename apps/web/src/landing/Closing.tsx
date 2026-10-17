import { ArrowUpRight } from "@phosphor-icons/react";
import { REPO_URL } from "./Nav";

export function Closing() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <h2 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tighter md:text-6xl">
          Watch two agents collide, then watch the graph stop them.
        </h2>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="/app"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-signal)] px-5 py-3 text-sm font-medium text-[#1a0d08] transition active:scale-[0.98]"
          >
            Open the live graph
            <ArrowUpRight size={16} weight="bold" />
          </a>
          <a
            href={REPO_URL}
            className="inline-flex items-center rounded-full border border-[var(--border)] px-5 py-3 text-sm font-medium transition hover:border-[var(--muted)] active:scale-[0.98]"
          >
            Read the source
          </a>
        </div>
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

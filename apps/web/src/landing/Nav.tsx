import { GithubLogo } from "@phosphor-icons/react";

export const REPO_URL = "https://github.com/bhargava-gumpula/graph-hacks";

/** A simple geometric mark: two nodes joined by an edge. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="5" cy="16" r="3" fill="var(--fg)" />
      <circle cx="17" cy="6" r="3" fill="var(--color-signal)" />
      <path d="M7.5 14 L14.5 8" stroke="var(--fg)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Nav() {
  const link = "text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)]";
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)]/60 bg-[var(--bg)]/75 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8" aria-label="Main">
        <a href="/" className="flex items-center gap-2.5 font-medium tracking-tight">
          <Mark />
          Switchboard
        </a>
        <div className="flex items-center gap-6">
          <a href="#how" className={`hidden md:inline ${link}`}>How it works</a>
          <a href="#proof" className={`hidden md:inline ${link}`}>Proof</a>
          <a href="/app" className={`hidden sm:inline ${link}`}>Live graph</a>
          <a href={REPO_URL} className={link} aria-label="Source code on GitHub">
            <GithubLogo size={20} />
          </a>
        </div>
      </nav>
    </header>
  );
}

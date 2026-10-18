import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  GithubLogo,
  PlayCircle,
} from "@phosphor-icons/react";
import bench from "../../../bench/results.json";
import "@fontsource-variable/archivo/wdth.css";
import "./delta/delta.css";
import { Survey } from "./delta/Survey";
import { edges, nodes } from "./delta/graph";
import { REPO_URL } from "./landing/Nav";

const VIDEO = "https://youtu.be/JeX7zCreNYI";
const n = bench.n;

function Cmd({ children }: { children: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="dl-cmd">
      <code>{children}</code>
      <button
        type="button"
        aria-label={`Copy ${children}`}
        onClick={() => {
          void navigator.clipboard?.writeText(children).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1400);
          });
        }}
      >
        {done ? <Check size={16} weight="bold" /> : <Copy size={16} />}
      </button>
    </div>
  );
}

const F = ({ children }: { children: string }) => (
  <span className="dl-file">{children}</span>
);

const KEY = [
  {
    sym: "imports",
    t: "Imports",
    d: "Parsed from your code into FalkorDB. One edge per import, file to file.",
  },
  {
    sym: "claims",
    t: "Claims",
    d: "Every edit claims its file for 30 minutes, renewed while the agent works.",
  },
  {
    sym: "refusal",
    t: "Refusals",
    d: "An edit is refused when an import path of up to 3 hops links it to another agent's claim. The path is the reason.",
  },
  {
    sym: "wait",
    t: "Waiting",
    d: "The refused agent waits on that file and is told the moment it is free.",
  },
  {
    sym: "memory",
    t: "Memory and briefings",
    d: "Decisions and handoffs stay in the graph. A new agent asks for a brief before it starts.",
  },
  {
    sym: "rounds",
    t: "Parallel rounds",
    d: "Tasks that share no path run in the same round, side by side.",
  },
];

function Chapter({
  id,
  cam,
  camSm,
  show,
  plate,
  className,
  children,
}: {
  id: string;
  cam: string;
  camSm: string;
  show?: string;
  plate: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-cam={cam}
      data-cam-sm={camSm}
      data-show={show}
      data-plate={plate}
      className={`ch ${className}`}
    >
      {children}
    </section>
  );
}

export function Landing() {
  return (
    <div className="dl-page">
      <a href="#main" className="dl-skip">
        Skip to content
      </a>
      <Survey />

      <header className="dl-nav">
        <nav aria-label="Main">
          <a href="/" className="dl-brand">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <circle cx="5" cy="16" r="3" fill="currentColor" />
              <circle cx="17" cy="6" r="3" fill="var(--color-signal)" />
              <path
                d="M7.5 14 L14.5 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Switchboard
          </a>
          <div className="dl-links">
            <a href="#how">How it works</a>
            <a href="#proof">Proof</a>
            <a href="#install">Install</a>
            <a
              href={REPO_URL}
              aria-label="Source code on GitHub"
              className="dl-gh"
            >
              <GithubLogo size={20} />
            </a>
          </div>
        </nav>
      </header>

      <main id="main">
        <Chapter
          id="top"
          className="ch-hero"
          cam="1430 850 2.05 0.64 0.6"
          camSm="1438 848 0.8 0.5 0.6"
          plate="Plate 1. The confluence, numbered along the import path"
        >
          <div data-obstacle className="hero-copy">
            <p className="dl-cap">
              The demo repo, surveyed: {bench.graph.files} files,{" "}
              {bench.graph.imports} imports
            </p>
            <h1 className="dl-h1">
              Agents can&apos;t see each other. <em>Switchboard can.</em>
            </h1>
            <p className="dl-body">
              One FalkorDB graph of imports and claims. An edit that would
              collide is refused, with the path as the reason.
            </p>
            <div className="dl-btns">
              <a href="/app?play=1" className="dl-btn dl-btn-primary">
                Open the live graph <ArrowUpRight size={16} weight="bold" />
              </a>
              <a href={REPO_URL} className="dl-btn dl-btn-ghost">
                <GithubLogo size={16} /> Source on GitHub
              </a>
            </div>
          </div>
        </Chapter>

        <Chapter
          id="problem"
          className="ch-problem"
          cam="1010 1000 2.0 0.3 0.52"
          camSm="1010 990 1.5 0.5 0.28"
          plate="Plate 2. Two imports between the edits"
        >
          <div data-obstacle className="problem-note dl-panel">
            <h2 className="dl-h2">
              Two edits pass alone. Merged, the build breaks.
            </h2>
            <p className="dl-body">
              Agents work in parallel and only see their own files. A file lock
              compares names, so it never notices that <F>LoginForm.tsx</F> and{" "}
              <F>session.ts</F> meet two imports downstream. CI finds out after
              both agents have finished.
            </p>
            <figure className="dl-err">
              <figcaption className="dl-cap">
                What the merge does, from the benchmark
              </figcaption>
              <code>{bench.mergedError}</code>
            </figure>
          </div>
        </Chapter>

        <Chapter
          id="how"
          className="ch-how"
          cam="1575 800 1.0 0.66 0.5"
          camSm="1500 820 1.0 0.5 0.26"
          show="all"
          plate={`Plate 3. The whole survey: ${nodes.length} files, ${edges.length} imports`}
        >
          <div data-obstacle className="how-sheet dl-panel">
            <h2 className="dl-h2">
              One graph. Imports are the channels, claims are the boats.
            </h2>
            <ul className="dl-key">
              {KEY.map((k) => (
                <li key={k.t}>
                  <span className={`sym sym-${k.sym}`} aria-hidden="true" />
                  <div>
                    <p className="dl-key-t">{k.t}</p>
                    <p className="dl-key-d">{k.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Chapter>

        <Chapter
          id="story"
          className="ch-story"
          cam="1440 850 1.7 0.66 0.5"
          camSm="1235 880 1.45 0.5 0.3"
          plate="Plate 4. Agent B held at the gate on login.ts"
        >
          {[
            <>
              <h2 className="dl-h2">Refused before it wrote a line.</h2>
              <p>
                Agent A holds <F>auth/session.ts</F> and is changing what it
                returns.
              </p>
            </>,
            <p>
              Agent B sets out to edit <F>ui/LoginForm.tsx</F>. It imports{" "}
              <F>api/login.ts</F>, which imports <F>auth/session.ts</F>.
            </p>,
            <>
              <p>
                One path query finds that link. B&apos;s edit is refused, and
                the reply is the path.
              </p>
              <div className="dl-refusal" role="note">
                <p>
                  Refused, {bench.conflict.type.toLowerCase()},{" "}
                  {bench.conflict.hops} hops
                </p>
                <p>{bench.conflict.path.join(" → ")}</p>
              </div>
            </>,
            <p>
              B waits on the file. When A&apos;s claim ends, B is told it is
              free and goes on.
            </p>,
          ].map((body, i) => (
            <div key={i} className="story-step" data-step={i}>
              <div data-obstacle className="story-card dl-panel">
                {body}
              </div>
            </div>
          ))}
        </Chapter>

        <Chapter
          id="proof"
          className="ch-proof"
          cam="1960 1130 1.3 0.82 0.5"
          camSm="2000 1150 1.4 0.5 0.5"
          plate={`Plate 5. Downstream, ${n} runs each way`}
        >
          <div data-obstacle className="proof-sheet dl-panel">
            <h2 className="dl-h2">Same edit, {n} runs each way.</h2>
            <div className="proof-row">
              <div>
                <p className="dl-num">
                  {bench.without.brokenBuilds}
                  <span>/{n}</span>
                </p>
                <p className="dl-num-l">builds broke without Switchboard</p>
                <ul
                  className="dl-runs"
                  aria-label={`Without Switchboard: ${bench.runs.without.join(", ")}`}
                >
                  {bench.runs.without.map((_, i) => (
                    <li key={i} className="run-fail" />
                  ))}
                </ul>
              </div>
              <div>
                <p className="dl-num dl-num-signal">
                  {bench.with.brokenBuilds}
                  <span>/{n}</span>
                </p>
                <p className="dl-num-l">
                  with Switchboard. Refused {bench.with.blocked} of {n} times,
                  before a line was written.
                </p>
                <ul
                  className="dl-runs"
                  aria-label={`With Switchboard: ${bench.runs.with.join(", ")}`}
                >
                  {bench.runs.with.map((_, i) => (
                    <li key={i} className="run-refused" />
                  ))}
                </ul>
              </div>
              <div>
                <p className="dl-num dl-num-ms">
                  {bench.checkMsMedian}
                  <span> ms</span>
                </p>
                <p className="dl-num-l">
                  median check, range {bench.checkMsMin} to {bench.checkMsMax}{" "}
                  ms
                </p>
              </div>
            </div>
            <p className="dl-caveat">
              Scripted agents, real {bench.tsc.replace("Version ", "tsc ")},
              real FalkorDB. Each edit typechecks on its own; we merge both and
              compile. Any check before merge, CI included, would also keep the
              build green. What changes is when the second agent finds out. The
              run is deterministic, so {n} runs show repeatability, not a
              statistic.
            </p>
            <div className="proof-src">
              <Cmd>npm run bench</Cmd>
              <a
                className="dl-small"
                href={`${REPO_URL}/blob/main/bench/results.json`}
              >
                Raw numbers in bench/results.json
              </a>
            </div>
          </div>
        </Chapter>

        <Chapter
          id="install"
          className="ch-install"
          cam="430 230 1.6 0.7 0.5"
          camSm="520 230 1.5 0.5 0.5"
          plate="Plate 6. The road in"
        >
          <div data-obstacle className="install-sheet dl-panel">
            <h2 className="dl-h2">Install in two commands.</h2>
            <p className="dl-body">
              Needs Node 22 or newer and a FalkorDB it can reach:
            </p>
            <Cmd>docker run -d -p 6379:6379 falkordb/falkordb</Cmd>
            <div className="install-cols">
              <div>
                <p className="install-t">Claude Code plugin</p>
                <Cmd>/plugin marketplace add bhargava-gumpula/graph-hacks</Cmd>
                <Cmd>/plugin install switchboard@switchboard</Cmd>
                <p className="install-t">Cursor</p>
                <Cmd>npx switchboard-agents init --cursor</Cmd>
              </div>
              <div>
                <p className="install-t">Global CLI</p>
                <Cmd>npm i -g switchboard-agents</Cmd>
                <p className="install-t">From source</p>
                <Cmd>
                  git clone https://github.com/bhargava-gumpula/graph-hacks.git
                </Cmd>
                <Cmd>cd graph-hacks && npm run quickstart</Cmd>
              </div>
            </div>
            <p className="dl-small">
              Hooks claim every edit, refuse a collision, and release the claims
              when the session ends.{" "}
              <a href={`${REPO_URL}/blob/main/docs/INSTALL.md`}>
                Every option in INSTALL.md
              </a>
            </p>
          </div>
        </Chapter>

        <Chapter
          id="end"
          className="ch-end"
          cam="1500 760 1.15 0.6 0.62"
          camSm="1440 850 1.0 0.5 0.62"
          plate="Plate 7. One map for every agent"
        >
          <div data-obstacle className="end-copy">
            <h2 className="dl-h2">Give your agents one map.</h2>
            <div className="dl-btns">
              <a href="/app?play=1" className="dl-btn dl-btn-primary">
                Open the live graph <ArrowUpRight size={16} weight="bold" />
              </a>
              <a href={VIDEO} className="dl-btn dl-btn-ghost">
                <PlayCircle size={16} /> Watch the demo
              </a>
              <a href={REPO_URL} className="dl-btn dl-btn-ghost">
                <GithubLogo size={16} /> Source on GitHub
              </a>
            </div>
          </div>
        </Chapter>
      </main>

      <footer className="dl-foot">
        <p>
          Built for Graph Hacks on FalkorDB. The routes are the demo repo&apos;s
          real imports, traced along the river&apos;s channels.
        </p>
        <p>
          Photos: Unsplash (
          <a href="https://unsplash.com/photos/aerial-view-of-a-braided-river-flowing-through-green-terrain-mzc0O2Qb9AM">
            Manu Alesanco
          </a>
          )
        </p>
      </footer>
    </div>
  );
}

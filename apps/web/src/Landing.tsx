import { useEffect, useRef, useState } from "react";
import { GraphCanvas } from "./GraphCanvas.js";
import type { GraphSnapshot } from "./types.js";

interface Bench {
  n: number;
  kind: string;
  without: { brokenBuilds: number; editsApplied: number };
  with: { brokenBuilds: number; blocked: number };
  checkMsMedian: number;
}

const PATH = ["ui/LoginForm.tsx", "api/login.ts", "auth/session.ts"];
const BEATS = [
  "A claims auth/session.ts",
  "B asks for ui/LoginForm.tsx",
  "LoginForm → login → session",
];

function asciiField(): string {
  const glyphs = " .+*|/\\-";
  const rows: string[] = [];
  for (let y = 0; y < 42; y++) {
    let line = "";
    for (let x = 0; x < 96; x++) {
      const n = (x * 17 + y * 31) % 23;
      line += n > 14 ? glyphs[n % glyphs.length] : " ";
    }
    rows.push(line);
  }
  return rows.join("\n");
}

const FIELD = asciiField();

export function Landing() {
  const [bench, setBench] = useState<Bench | null>(null);
  const [graph, setGraph] = useState<GraphSnapshot | null>(null);
  const scene = useRef<HTMLElement>(null);

  useEffect(() => {
    void fetch("/bench/results.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setBench)
      .catch(() => setBench(null));
    void fetch("/api/graph")
      .then((r) => (r.ok ? r.json() : null))
      .then(setGraph)
      .catch(() => setGraph(null));
  }, []);

  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    let beat = 0;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const span = Math.max(1, rect.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -rect.top / span));
      document.documentElement.style.setProperty("--p", p.toFixed(3));
      const next = Math.min(BEATS.length - 1, Math.floor(p * BEATS.length));
      if (next !== beat) {
        beat = next;
        el.dataset.beat = String(next);
      }
    };
    onScroll();
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="landing">
      <pre className="ascii" aria-hidden="true">{FIELD}</pre>
      <header className="bar">
        <a href="/">SWITCHBOARD</a>
        <nav>
          <a href="/app">Demo</a>
          <a href="/judge">Judge</a>
        </nav>
      </header>
      <main>
        <section className="intro">
          <p className="kicker">Agent memory and coordination · FalkorDB</p>
          <h1>A file lock would have allowed the edit.</h1>
          <p className="lede">The globe is the import graph. A path means two agents will collide.</p>
          <p className="cta">
            <a className="play" href="/app">Play the demo</a>
          </p>
        </section>
        <section className="scene" ref={scene} data-beat="0">
          <div className="scene-pin">
            <div className="preview">
              <div className="preview-bar">
                <span>SWITCHBOARD</span>
                <span className="muted">live</span>
                <a href="/app">Open</a>
              </div>
              <div className="preview-body">
                <div className="preview-globe">
                  <GraphCanvas data={graph} hotPath={PATH} quiet />
                </div>
                <aside className="preview-panel">
                  {BEATS.map((line) => (
                    <p key={line} className="preview-line">{line}</p>
                  ))}
                  <p className="muted">Hover a dot. The lines are imports.</p>
                  <p>A · session.ts</p>
                  <p className="muted">Checked in {bench ? `${bench.checkMsMedian} ms` : "…"}</p>
                </aside>
              </div>
            </div>
          </div>
        </section>
        <section className="paper">
          <div className="proof">
            <p className="proof-kicker">Conflict check</p>
            {bench ? (
              <dl>
                <div><dt>Edit went through</dt><dd>{bench.without.brokenBuilds}/{bench.n} builds broke</dd></div>
                <div><dt>Switchboard blocked it</dt><dd>{bench.with.brokenBuilds}/{bench.n} broke</dd></div>
                <div><dt>Median check</dt><dd>{bench.checkMsMedian} ms</dd></div>
              </dl>
            ) : (
              <p>Run <code>npm run bench</code>. These rows are read from <code>bench/results.json</code>.</p>
            )}
            <div className="meter" />
          </div>
          <h2 className="punch">
            {bench ? (
              <>{bench.with.brokenBuilds} broke. <em>In {bench.checkMsMedian} ms.</em></>
            ) : (
              "The check is the product."
            )}
          </h2>
        </section>
        <section className="paper-block">
          <h2>What a file lock cannot say</h2>
          <table>
            <thead>
              <tr><th></th><th>Knows the import graph</th><th>Memory in the same store</th></tr>
            </thead>
            <tbody>
              <tr><td>File lock / agent teams</td><td>No. The filename is the lock.</td><td>A task list, separate from the code.</td></tr>
              <tr><td>Nerveplane</td><td>Hand-declared scopes.</td><td>SQLite.</td></tr>
              <tr><td>wit</td><td>One hop, advisory.</td><td>No.</td></tr>
              <tr><td>Switchboard</td><td>Parsed imports, up to 3 hops, both directions.</td><td>Claims, decisions, lessons, and edits in FalkorDB.</td></tr>
            </tbody>
          </table>
          <p className="muted">{bench?.kind}</p>
        </section>
      </main>
    </div>
  );
}

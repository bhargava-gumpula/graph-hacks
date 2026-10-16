import { useEffect, useState } from "react";

interface Bench {
  n: number;
  kind: string;
  without: { brokenBuilds: number; editsApplied: number };
  with: { brokenBuilds: number; blocked: number };
  checkMsMedian: number;
}

export function Landing() {
  const [bench, setBench] = useState<Bench | null>(null);

  useEffect(() => {
    void fetch("/bench/results.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setBench)
      .catch(() => setBench(null));
  }, []);

  return (
    <div className="landing">
      <header className="bar">
        <a href="/">SWITCHBOARD</a>
        <nav>
          <a href="/app">Demo</a>
          <a href="/judge">Judge</a>
        </nav>
      </header>
      <main>
        <p className="kicker">Agent memory and coordination · FalkorDB</p>
        <h1>A file lock would have allowed the edit.</h1>
        <p className="lede">
          Switchboard checks an agent’s edit against the code’s real import graph. If two agents would collide three files apart, the graph returns the path and the edit stops.
        </p>
        <p className="cta">
          <a className="play" href="/app">Play the demo</a>
        </p>
        <section className="numbers">
          {bench ? (
            <>
              <div>
                <strong>{bench.without.brokenBuilds}/{bench.n}</strong>
                <span>builds broke when the edit went through</span>
              </div>
              <div>
                <strong>{bench.with.brokenBuilds}/{bench.n}</strong>
                <span>broke when Switchboard blocked it</span>
              </div>
              <div>
                <strong>{bench.checkMsMedian} ms</strong>
                <span>median conflict check</span>
              </div>
            </>
          ) : (
            <p>Run <code>npm run bench</code> to fill these numbers. They are read from <code>bench/results.json</code>.</p>
          )}
        </section>
        <section>
          <h2>How it works</h2>
          <ol>
            <li>The repo is parsed into File nodes and IMPORTS edges in FalkorDB.</li>
            <li>An agent claims the files it is about to edit.</li>
            <li>The next claim is a path query. A path means conflict. No path means safe.</li>
            <li>Decisions, edits, and handoffs are nodes in the same graph, so a replacement agent can be briefed from it.</li>
          </ol>
        </section>
        <section>
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
        </section>
      </main>
    </div>
  );
}

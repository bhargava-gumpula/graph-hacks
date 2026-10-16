import { useState } from "react";

export function Judge() {
  const [out, setOut] = useState("Press a button. Each one runs a real FalkorDB query.");
  const [busy, setBusy] = useState(false);

  async function run(label: string, go: () => Promise<unknown>) {
    setBusy(true);
    setOut(`${label}\n…`);
    try {
      setOut(`${label}\n${JSON.stringify(await go(), null, 2)}`);
    } catch (err) {
      setOut(`${label}\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

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
        <h1>Sixty seconds</h1>
        <p className="lede">Three buttons. The conflict check, the batches, and the why-trace. The first button seeds the graph.</p>
        <p className="cta">
          <button className="play" type="button" disabled={busy} onClick={() => void run("Conflict", () => fetch("/api/demo", { method: "POST" }).then((r) => r.json()))}>
            Conflict
          </button>
          <button className="play secondary" type="button" disabled={busy} onClick={() => void run("Batches", () => fetch("/api/batches").then((r) => r.json()))}>
            Batches
          </button>
          <button className="play secondary" type="button" disabled={busy} onClick={() => void run("Why", () => fetch("/api/why?path=lib/crypto.ts").then((r) => r.json()))}>
            Why
          </button>
        </p>
        <pre className="judge-out">{out}</pre>
        <QueryCard title="Conflict" query="Files B wants, walked up to 3 IMPORTS hops, against A's active claims. Hubs skipped." />
        <QueryCard title="Batches" query="Open tasks that can reach each other through imports get an INTERFERES edge. algo.WCC splits them into batches." />
        <QueryCard title="Why" query="Edit event → agent → task → decision that caused the task." />
      </main>
    </div>
  );
}

function QueryCard({ title, query }: { title: string; query: string }) {
  return (
    <section>
      <h2>{title}</h2>
      <p>{query}</p>
    </section>
  );
}

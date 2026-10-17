import { useEffect, useState } from "react";
import { GraphCanvas } from "./GraphCanvas.js";
import type { Conflict, FeedItem, GraphSnapshot } from "./types.js";

interface Claim {
  agent: string;
  path: string;
  taskId: string | null;
}
interface Batch {
  tasks: string[];
}
interface Decision {
  id: string;
  text: string;
  status: string | null;
  agent: string | null;
}

export function App() {
  const [graph, setGraph] = useState<GraphSnapshot | null>(null);
  const [hotPath, setHotPath] = useState<string[]>([]);
  const [status, setStatus] = useState("loading");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [events, setEvents] = useState<FeedItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [playing, setPlaying] = useState(false);
  const [story, setStory] = useState<{ sentence: string; checkMs: number; batches: string[][]; why: string[] } | null>(null);

  const refresh = () => {
    void fetch("/api/claims").then((r) => r.json()).then(setClaims);
    void fetch("/api/batches").then((r) => r.json()).then(setBatches);
    void fetch("/api/decisions").then((r) => r.json()).then(setDecisions);
  };

  useEffect(() => {
    let last = 0;
    let es: EventSource | null = null;
    const load = () => fetch("/api/graph").then((r) => r.json()).then(setGraph);
    load()
      .then(() => {
        setStatus("live");
        refresh();
        es = new EventSource(`/api/events?last=${last}`);
        es.addEventListener("event", (ev) => {
          const item = JSON.parse((ev as MessageEvent).data) as FeedItem;
          last = item.seq;
          setEvents((prev) => [item, ...prev].slice(0, 8));
          if (item.kind === "conflict") {
            const hit = (item.payload as { conflicts?: Conflict[] })?.conflicts?.[0];
            if (hit) setHotPath(hit.path);
          }
          if (item.kind === "claim" || item.kind === "release" || item.kind === "conflict" || item.kind === "decision") {
            void load();
            refresh();
          }
        });
      })
      .catch(() => setStatus("server offline — start with npm run server"));
    return () => es?.close();
  }, []);

  async function playDemo() {
    setPlaying(true);
    setStatus("Two agents are claiming files…");
    try {
      const result = (await fetch("/api/demo", { method: "POST" }).then((r) => r.json())) as {
        sentence: string;
        checkMs: number;
        path: string[];
        batches: string[][];
        why: string[];
      };
      setHotPath(result.path);
      setStory(result);
      setDetail(result.why.join(" → "));
      setSelected("lib/crypto.ts");
      setStatus("Demo played");
      const snapshot = (await fetch("/api/graph").then((r) => r.json())) as GraphSnapshot;
      setGraph(snapshot);
      refresh();
    } catch {
      setStatus("Demo failed. Is FalkorDB running? npm run db:up");
    } finally {
      setPlaying(false);
    }
  }

  async function showBlast(path: string) {
    setSelected(path);
    const blast = (await fetch(`/api/blast?path=${encodeURIComponent(path)}`).then((r) => r.json())) as {
      dependents: { path: string; hops: number }[];
    };
    const chain = [path, ...blast.dependents.map((d) => d.path)];
    setHotPath(chain);
    setDetail(blast.dependents.length === 0 ? `${path}\nno dependents` : blast.dependents.map((d) => `${d.hops}  ${d.path}`).join("\n"));
    setStatus(`blast ${path}`);
  }

  async function showWhy(path: string) {
    setSelected(path);
    const hits = (await fetch(`/api/why?path=${encodeURIComponent(path)}`).then((r) => r.json())) as { path: string[] }[];
    if (hits.length === 0) {
      setDetail(`${path}\nno recorded edits`);
      return;
    }
    setHotPath(hits[0]?.path.filter((step) => step.includes("/")) ?? []);
    setDetail(hits.map((h) => h.path.join(" → ")).join("\n"));
    setStatus(`why ${path}`);
  }

  return (
    <div className="app">
      <header className="bar">
        <h1><a href="/">SWITCHBOARD</a></h1>
        <span className="status">{status}</span>
        <button className="play" type="button" disabled={playing} onClick={() => void playDemo()}>
          {playing ? "Running…" : "Play the demo"}
        </button>
      </header>
      <div className="main">
        <div className="stage">
          <GraphCanvas data={graph} hotPath={hotPath} onSelect={(id) => void showBlast(id)} />
          <div className="legend">
            <span><i className="swatch" style={{ background: "#8ab4f8" }} /> file</span>
            <span><i className="swatch" style={{ background: "#fbbc04" }} /> hub</span>
            <span><i className="swatch" style={{ background: "#81c995" }} /> claimed</span>
            <span><i className="swatch" style={{ background: "#ea4335" }} /> path</span>
            <span>drag the globe</span>
          </div>
        </div>
        <aside className="panel">
          <p className="sentence">{story ? story.sentence : "The globe keeps turning. Hover a file and the imports shoot out."}</p>
          <h2>Claims</h2>
          {claims.length === 0 && <p className="muted">No one has claimed a file yet.</p>}
          {claims.map((c) => (
            <button key={`${c.agent}:${c.path}`} type="button" onClick={() => void showBlast(c.path)}>
              {c.agent} · {c.path.split("/").pop()}
            </button>
          ))}
          <h2>Batches</h2>
          {batches.length === 0 && <p className="muted">no open tasks</p>}
          {batches.map((b, i) => (
            <p key={i}>{b.tasks.join(", ")}</p>
          ))}
          <h2>Decisions</h2>
          {decisions.length === 0 && <p className="muted">none</p>}
          {decisions.map((d) => (
            <p key={d.id}>
              {d.text}
              <span className="muted"> {d.agent ?? ""}</span>
            </p>
          ))}
          <h2>Events</h2>
          {events.filter((e) => e.kind === "claim" || e.kind === "conflict" || e.kind === "decision" || e.kind === "edit").map((e) => (
            <p key={e.seq}>
              {e.kind} {e.onKey ?? ""}
            </p>
          ))}
          {selected && (
            <>
              <h2>{selected.split("/").pop()}</h2>
              <button type="button" onClick={() => void showWhy(selected)}>
                Why
              </button>
              <pre>{detail}</pre>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

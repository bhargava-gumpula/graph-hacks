import { useEffect, useState } from "react";
import { GraphCanvas } from "./GraphCanvas.js";
import type { Conflict, FeedItem, GraphSnapshot } from "./types.js";

export function App() {
  const [graph, setGraph] = useState<GraphSnapshot | null>(null);
  const [hotPath, setHotPath] = useState<string[]>([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let last = 0;
    let es: EventSource | null = null;
    const load = () => fetch("/api/graph").then((r) => r.json()).then(setGraph);
    load()
      .then(() => {
        setStatus("live");
        es = new EventSource(`/api/events?last=${last}`);
        es.addEventListener("event", (ev) => {
          const item = JSON.parse((ev as MessageEvent).data) as FeedItem;
          last = item.seq;
          if (item.kind === "conflict") {
            const conflicts = (item.payload as { conflicts?: Conflict[] })?.conflicts ?? [];
            setHotPath(conflicts[0]?.path ?? []);
            setStatus(
              `CONFLICT ${conflicts[0]?.path.join(" → ") ?? ""} ← ${conflicts[0]?.agent ?? item.agentId}`,
            );
          }
          if (item.kind === "claim" || item.kind === "release" || item.kind === "conflict") void load();
        });
      })
      .catch(() => setStatus("server offline — start with npm run server"));
    return () => es?.close();
  }, []);

  return (
    <div className="app">
      <header className="bar">
        <h1>SWITCHBOARD</h1>
        <span className={hotPath.length ? "status conflict" : "status"}>{status}</span>
      </header>
      <GraphCanvas data={graph} hotPath={hotPath} />
      <div className="legend">
        <span><i className="swatch" style={{ background: "#8ab4f8" }} /> file</span>
        <span><i className="swatch" style={{ background: "#fbbc04" }} /> hub</span>
        <span><i className="swatch" style={{ background: "#81c995" }} /> claimed</span>
        <span><i className="swatch" style={{ background: "#ea4335" }} /> conflict path</span>
      </div>
    </div>
  );
}

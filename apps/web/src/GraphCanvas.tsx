import { DirectedGraph } from "graphology";
import { useEffect, useRef } from "react";
import Sigma from "sigma";
import type { GraphSnapshot } from "./types.js";

const COLOR = {
  file: "#8ab4f8",
  hub: "#fbbc04",
  claimed: "#81c995",
  agent: "#f28b82",
  import: "#3c4454",
  claims: "#81c995",
  hot: "#ea4335",
};

function layout(i: number, n: number, radius: number): { x: number; y: number } {
  const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function GraphCanvas({ data, hotPath }: { data: GraphSnapshot | null; hotPath: string[] }) {
  const el = useRef<HTMLDivElement>(null);
  const sigma = useRef<Sigma | null>(null);
  const hot = useRef(hotPath);
  hot.current = hotPath;

  useEffect(() => {
    if (!el.current || !data) return;
    sigma.current?.kill();
    const graph = new DirectedGraph();
    const files = data.nodes.filter((n) => n.kind === "file");
    const agents = data.nodes.filter((n) => n.kind === "agent");
    files.forEach((n, i) => {
      const { x, y } = layout(i, files.length, 8);
      const claimed = (n.claimedBy?.length ?? 0) > 0;
      graph.addNode(n.id, {
        label: n.label,
        x,
        y,
        size: n.hub ? 8 : claimed ? 6 : 4,
        color: n.hub ? COLOR.hub : claimed ? COLOR.claimed : COLOR.file,
        kind: n.kind,
      });
    });
    agents.forEach((n, i) => {
      const { x, y } = layout(i, agents.length, 11);
      graph.addNode(n.id, { label: n.label, x, y, size: 7, color: COLOR.agent, kind: n.kind });
    });
    for (const e of data.edges) {
      if (!graph.hasNode(e.source) || !graph.hasNode(e.target) || graph.hasEdge(e.source, e.target)) continue;
      graph.addEdge(e.source, e.target, {
        kind: e.kind,
        color: e.kind === "CLAIMS" ? COLOR.claims : COLOR.import,
        size: e.kind === "CLAIMS" ? 2 : 1,
      });
    }
    const s = new Sigma(graph, el.current, {
      settings: { renderEdgeLabels: false },
      nodeReducer: (node, attrs) => {
        const path = hot.current;
        if (path.length === 0) return attrs;
        const on = path.includes(node);
        return { ...attrs, color: on ? COLOR.hot : "#2a3140", size: on ? 8 : 3 };
      },
      edgeReducer: (edge, attrs) => {
        const path = hot.current;
        if (path.length < 2) return attrs;
        const src = graph.source(edge);
        const tgt = graph.target(edge);
        const on = path.some((p, i) => path[i + 1] && ((src === p && tgt === path[i + 1]) || (tgt === p && src === path[i + 1])));
        return { ...attrs, color: on ? COLOR.hot : "#1b2030", size: on ? 3 : 0.5 };
      },
    });
    sigma.current = s;
    return () => {
      s.kill();
      sigma.current = null;
    };
  }, [data]);

  useEffect(() => {
    sigma.current?.refresh();
  }, [hotPath]);

  return <div ref={el} className="canvas" style={{ height: "100%" }} />;
}

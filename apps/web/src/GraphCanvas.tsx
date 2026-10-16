import { DirectedGraph } from "graphology";
import { useEffect, useRef } from "react";
import Sigma, { DEFAULT_STYLES } from "sigma";
import type { GraphNode, GraphSnapshot } from "./types.js";

const COLOR = {
  file: "#9ec1ff",
  hub: "#f5c451",
  claimed: "#7dcea0",
  agent: "#f0a39a",
  import: "#4a5568",
  claims: "#7dcea0",
  hot: "#ff5a4f",
  dim: "#242a36",
  dimEdge: "#1a1f2a",
};

const COLUMN_ORDER = ["ui", "api", "auth", "lib"];

/** One column per directory, files stacked so imports run left → right. */
function placeFiles(files: GraphNode[]): Map<string, { x: number; y: number }> {
  const groups = new Map<string, GraphNode[]>();
  for (const file of files) {
    const slash = file.id.indexOf("/");
    const dir = slash >= 0 ? file.id.slice(0, slash) : ".";
    const list = groups.get(dir) ?? [];
    list.push(file);
    groups.set(dir, list);
  }
  const dirs = [...groups.keys()].sort((a, b) => {
    const ia = COLUMN_ORDER.indexOf(a);
    const ib = COLUMN_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const pos = new Map<string, { x: number; y: number }>();
  const gap = 2.2;
  dirs.forEach((dir, col) => {
    const list = groups.get(dir)!.sort((a, b) => a.label.localeCompare(b.label));
    const height = (list.length - 1) * gap;
    list.forEach((node, row) => {
      pos.set(node.id, { x: col * 5.5, y: row * gap - height / 2 });
    });
  });
  return pos;
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
    const placed = placeFiles(files);

    for (const node of files) {
      const at = placed.get(node.id) ?? { x: 0, y: 0 };
      const claimed = (node.claimedBy?.length ?? 0) > 0;
      graph.addNode(node.id, {
        label: node.label,
        labelColor: "#e8eaed",
        labelVisibility: "visible",
        labelSize: 13,
        x: at.x,
        y: at.y,
        size: node.hub ? 9 : claimed ? 7 : 5,
        color: node.hub ? COLOR.hub : claimed ? COLOR.claimed : COLOR.file,
      });
    }
    agents.forEach((node, i) => {
      graph.addNode(node.id, {
        label: node.label,
        x: -6,
        y: (i - (agents.length - 1) / 2) * 3,
        size: 10,
        color: COLOR.agent,
      });
    });
    const above = Math.max(...[...placed.values()].map((p) => p.y)) + 3.2;
    COLUMN_ORDER.forEach((dir, col) => {
      graph.addNode(`dir:${dir}`, {
        label: dir,
        x: col * 5.5,
        y: above,
        size: 2,
        color: "#0e1116",
      });
    });

    for (const edge of data.edges) {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
      if (graph.hasDirectedEdge(edge.source, edge.target)) continue;
      graph.addDirectedEdge(edge.source, edge.target, {
        color: edge.kind === "CLAIMS" ? COLOR.claims : COLOR.import,
        size: edge.kind === "CLAIMS" ? 2.5 : 1.2,
      });
    }

    const s = new Sigma(graph, el.current, {
      settings: {
        renderEdgeLabels: false,
        itemSizesReference: "screen",
        labelDensity: 2,
        labelRenderedSizeThreshold: 0,
        labelGridCellSize: 1,
        minEdgeThickness: 1,
        stagePadding: 48,
      },
      styles: {
        stage: { background: "#0e1116" },
        nodes: {
          ...DEFAULT_STYLES.nodes,
          labelColor: "#e8eaed",
          labelSize: 12,
          labelVisibility: "visible",
        },
      },
      nodeReducer: (node, attrs) => {
        const labeled = {
          ...attrs,
          labelVisibility: "visible" as const,
          labelColor: node.startsWith("dir:") ? "#9aa0a6" : "#e8eaed",
          labelSize: node.startsWith("dir:") ? 16 : 13,
          labelPosition: (node.startsWith("lib/") ? "left" : "right") as "left" | "right",
        };
        const path = hot.current;
        if (node.startsWith("dir:") || path.length === 0 || !path.includes(node)) return labeled;
        return { ...labeled, color: COLOR.hot, size: 10 };
      },
      edgeReducer: (edge, attrs) => {
        const path = hot.current;
        if (path.length < 2) return attrs;
        const src = graph.source(edge);
        const tgt = graph.target(edge);
        const on = path.some(
          (step, i) =>
            path[i + 1] !== undefined &&
            ((src === step && tgt === path[i + 1]) || (tgt === step && src === path[i + 1])),
        );
        return { ...attrs, color: on ? COLOR.hot : COLOR.dimEdge, size: on ? 4 : 0.6 };
      },
    });
    sigma.current = s;
    void s.getCamera().reset();
    return () => {
      s.kill();
      sigma.current = null;
    };
  }, [data]);

  useEffect(() => {
    sigma.current?.refresh();
  }, [hotPath]);

  return <div ref={el} className="canvas" />;
}

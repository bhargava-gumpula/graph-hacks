import type React from 'react';
import raw from '../../apps/web/src/data/graph.json';
import bench from '../../bench/results.json';
import {C, MONO, clamp01, prog} from './theme';

// The real demo-repo graph (files + imports) that the web app ships.
// The conflict path from bench/results.json, B's file first: ui/LoginForm.tsx -> api/login.ts -> auth/session.ts.
export const PATH: string[] = bench.conflict.path;
/** A's claimed file and B's wanted file. */
export const CLAIMED = bench.claim.file;
export const WANTED = bench.edit.file;
// One file per folder sits on the middle row (lib/crypto.ts only anchors the lib column), so the path is one straight line.
const CHAIN = [...PATH, 'lib/crypto.ts'];
const FOLDERS = ['ui', 'api', 'auth', 'lib'];
const HUB = 'lib/utils.ts';

export type GNode = {id: string; label: string; col: number; x: number; y: number};
export type GEdge = {s: GNode; t: GNode; d: string; hop: number; order: number};
export type Layout = ReturnType<typeof layoutGraph>;

export const NODE_COUNT = raw.nodes.length;
export const EDGE_COUNT = raw.edges.length;

export const layoutGraph = (vertical: boolean) => {
	const box = vertical ? {l: 40, r: 1040, t: 440, b: 1280} : {l: 160, r: 1760, t: 240, b: 918};
	const pillW = vertical ? 206 : 236;
	const pillH = vertical ? 44 : 36;
	const font = vertical ? 17 : 19;
	const gap = vertical ? 44 : 30; // extra air above and below the chain row, room for the claim tags
	const colW = (box.r - box.l) / FOLDERS.length;
	const s = (box.b - box.t - 2 * gap) / 11;
	const cy = box.t + 6 * s + gap; // the chain row: one file per folder, so the conflict path is one straight line

	const nodes: GNode[] = [];
	FOLDERS.forEach((folder, col) => {
		const ids = raw.nodes.map((n) => n.id).filter((id) => id.startsWith(folder + '/'));
		const chain = ids.find((id) => CHAIN.includes(id))!;
		const rest = ids.filter((id) => id !== chain && id !== HUB).sort();
		const ci = Math.min(6, Math.floor(ids.length / 2));
		const order = [...rest.slice(0, ci), chain, ...rest.slice(ci)];
		if (ids.includes(HUB)) order.push(HUB); // the hub sits at the bottom so its 20 importers fan out below the chain
		order.forEach((id, i) =>
			nodes.push({id, label: id.split('/')[1], col, x: box.l + colW * (col + 0.5), y: cy + (i - ci) * s + Math.sign(i - ci) * gap}),
		);
	});
	const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

	const edges: GEdge[] = raw.edges
		.map((e) => {
			const a = byId[e.source];
			const b = byId[e.target];
			let d: string;
			if (a.col === b.col) {
				const x = a.x + pillW / 2;
				const bulge = 36 + Math.abs(b.y - a.y) * 0.3;
				d = `M${x},${a.y} C${x + bulge},${a.y} ${x + bulge},${b.y} ${x},${b.y}`;
			} else {
				const x0 = a.x + pillW / 2;
				const x1 = b.x - pillW / 2;
				const k = (x1 - x0) * 0.5;
				d = `M${x0},${a.y} C${x0 + k},${a.y} ${x1 - k},${b.y} ${x1},${b.y}`;
			}
			const i = PATH.indexOf(e.source);
			const hop = i >= 0 && PATH[i + 1] === e.target ? i + 1 : 0;
			return {s: a, t: b, d, hop, order: 0};
		})
		.sort((p, q) => p.s.col - q.s.col || p.s.y - q.s.y)
		.map((e, order) => ({...e, order}));

	return {nodes, edges, byId, pillW, pillH, font, cy, top: box.t, s, colX: (c: number) => box.l + colW * (c + 0.5), FOLDERS};
};

/** Build pacing: when each node / edge starts, relative to the build start. */
const pace = (fast: boolean) =>
	fast ? {col: 4, row: 0.5, edge0: 12, edge: 0.45, edgeDur: 10} : {col: 7, row: 1, edge0: 30, edge: 0.85, edgeDur: 16};

const nodeStart = (g: Layout, n: GNode, fast: boolean) => {
	const p = pace(fast);
	const rank = g.nodes.filter((m) => m.col === n.col && m.y < n.y).length;
	return n.col * p.col + rank * p.row;
};

export const buildCounts = (g: Layout, t: number, fast: boolean) => {
	const p = pace(fast);
	return {
		files: g.nodes.filter((n) => t >= nodeStart(g, n, fast)).length,
		imports: g.edges.filter((e) => t >= p.edge0 + e.order * p.edge).length,
	};
};

export const GraphView: React.FC<{
	g: Layout;
	/** Frames since the build started (Infinity = fully built). */
	t: number;
	fast?: boolean;
	/** 0..1 how far the non-chain graph is dimmed. */
	dim?: number;
	/** 0..PATH.length-1: how many hops of the path are lit (fractional = drawing). */
	lit?: number;
	/** 0..1 white ring on B's target. */
	target?: number;
	/** Extra scale per node id (impact recoil, packet pass). */
	bump?: (id: string) => number;
	/** A node already held by another agent's claim (orange). */
	claimed?: string;
}> = ({g, t, fast = false, dim = 0, lit = 0, target = 0, bump, claimed}) => {
	const p = pace(fast);
	const fade = 1 - 0.78 * dim;
	return (
		<>
			<svg width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
				{g.edges.map((e) => {
					const st = p.edge0 + e.order * p.edge;
					const dp = prog(t, st, p.edgeDur);
					return (
						<path
							key={e.s.id + e.t.id}
							d={e.d}
							pathLength={1}
							fill="none"
							stroke={C.muted}
							strokeWidth={1.5}
							strokeDasharray={1}
							strokeDashoffset={1 - dp}
							opacity={0.34 * (e.hop ? 1 : fade)}
						/>
					);
				})}
				{g.edges
					.filter((e) => e.hop)
					.map((e) => (
						<path
							key={'lit' + e.hop}
							d={e.d}
							pathLength={1}
							fill="none"
							stroke={C.accent}
							strokeWidth={4}
							strokeLinecap="round"
							strokeDasharray={1}
							strokeDashoffset={1 - clamp01(lit - (e.hop - 1))}
							opacity={lit > e.hop - 1 ? 1 : 0}
						/>
					))}
			</svg>
			{g.FOLDERS.map((folder, c) => (
				<div
					key={folder}
					style={{
						position: 'absolute',
						left: g.colX(c) - g.pillW / 2,
						top: g.top - g.pillH / 2 - g.font - 22,
						fontFamily: MONO,
						fontSize: g.font + 3,
						color: C.muted,
						opacity: (t >= c * p.col ? 1 : 0) * fade,
						translate: `0px ${(1 - prog(t, c * p.col, 5)) * 30}px`,
					}}
				>
					{folder}/
				</div>
			))}
			{g.nodes.map((n) => {
				const st = nodeStart(g, n, fast);
				const ci = PATH.indexOf(n.id);
				const isLit = (ci > 0 && lit >= ci) || n.id === claimed;
				const isTarget = ci === 0 && target > 0;
				return (
					<div
						key={n.id}
						style={{
							position: 'absolute',
							left: n.x - g.pillW / 2,
							top: n.y - g.pillH / 2,
							width: g.pillW,
							height: g.pillH,
							boxSizing: 'border-box',
							borderRadius: 9,
							background: C.panel,
							border: isLit ? `2px solid ${C.accent}` : isTarget ? `2px solid ${C.text}` : `1px solid #2d2d35`,
							boxShadow: isLit ? '0 0 28px rgba(255,106,61,0.35)' : 'none',
							display: 'flex',
							alignItems: 'center',
							paddingLeft: 14,
							fontFamily: MONO,
							fontSize: g.font,
							color: isLit || isTarget ? '#ffffff' : '#c4c4cc',
							opacity: (t >= st ? 1 : 0) * (ci >= 0 ? 1 : fade),
							translate: `0px ${(1 - prog(t, st, 6)) * 22}px`,
							scale: String(1 + (bump ? bump(n.id) : 0)),
						}}
					>
						{n.label}
					</div>
				);
			})}
		</>
	);
};

/** A small tag above a node: "A · editing" etc. */
export const NodeTag: React.FC<{g: Layout; id: string; text: string; color: string; style?: React.CSSProperties}> = ({
	g,
	id,
	text,
	color,
	style,
}) => {
	const n = g.byId[id];
	return (
		<div
			style={{
				position: 'absolute',
				left: n.x - g.pillW / 2,
				top: n.y - g.pillH / 2 - (g.font + 26),
				fontFamily: MONO,
				fontSize: g.font + 1,
				fontWeight: 600,
				color: color === C.text ? C.bg : '#ffffff',
				background: color,
				borderRadius: 6,
				padding: '3px 10px',
				whiteSpace: 'nowrap',
				...style,
			}}
		>
			{text}
		</div>
	);
};

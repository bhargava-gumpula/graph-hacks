import type React from 'react';
import {Interactive, useCurrentFrame} from 'remotion';
import {C, MONO, SANS, arrive, cascade, nudge, prog} from '../theme';
import {Head, Seam, VoCue, type SceneProps} from '../ui';

// Object breakdown: four isometric planes of one graph that separate on a nudge curve.
const L = 380; // plane side (local px)
const CX = 1080;
const SLAB = 600;
const YS = [318, 490, 662, 834];
const LAYERS = [
	{name: 'Agents', desc: 'who is working'},
	{name: 'Claims', desc: 'what each agent is editing'},
	{name: 'Memory', desc: 'what agents learned'},
	{name: 'Code graph', desc: '35 files · 51 imports'},
];
const DOTS = [50, 143, 236, 330].flatMap((x) => [95, 190, 285].map((y) => ({x, y})));
// Mini graph: four columns like ui/ api/ auth/ lib/. A holds the auth file (k 7), B is at the ui file (k 1), path 1 -> 4 -> 7.
const A_K = 7;
const A_PT = DOTS[A_K]; // auth/session.ts in the mini graph
const B_PT = DOTS[1];
// rotateX(60deg) rotateZ(-45deg), orthographic: local (u,v) around the centre -> screen offset.
const iso = (p: {x: number; y: number}) => {
	const u = p.x - L / 2;
	const v = p.y - L / 2;
	return {x: 0.7071 * (u - v), y: 0.5 * 0.7071 * (u + v)};
};
const SEP = cascade(42, 4, 3);

const Plane: React.FC<{i: number; y: number; hit: number; ring: number}> = ({i, y, hit, ring}) => (
	<div
		style={{
			position: 'absolute',
			left: CX - L / 2,
			top: y - L / 2,
			width: L,
			height: L,
			transform: 'rotateX(60deg) rotateZ(45deg)',
			background: 'rgba(17,17,20,0.9)',
			border: `1.5px solid ${i === 1 && ring ? '#5a3a30' : '#30303a'}`,
			borderRadius: 14,
		}}
	>
		<pre style={{margin: 0, padding: 14, fontFamily: MONO, fontSize: 14, lineHeight: '24px', color: C.faint, opacity: 0.7}}>
			{Array.from({length: 15}, () => '.  '.repeat(13)).join('\n')}
		</pre>
		<svg width={L} height={L} style={{position: 'absolute', inset: 0}}>
			{i === 3 && (
				<>
					{[
						[1, 4],
						[4, 7],
						[7, 10],
						[1, 3],
						[2, 5],
						[3, 8],
						[5, 11],
						[6, 10],
						[9, 10],
					].map(([a, b]) => (
						<line key={`${a}-${b}`} x1={DOTS[a].x} y1={DOTS[a].y} x2={DOTS[b].x} y2={DOTS[b].y} stroke={[1, 4].includes(a) && [4, 7].includes(b) ? C.text : C.muted} strokeOpacity={0.55} strokeWidth={2} />
					))}
					{DOTS.map((d, k) => (
						<circle key={k} cx={d.x} cy={d.y} r={k === A_K && hit ? 15 : 11} fill={k === A_K && hit ? C.accent : C.panel} stroke={k === A_K && hit ? C.accent : C.text} strokeWidth={2} />
					))}
				</>
			)}
			{i === 2 &&
				[
					{x: 40, y: 50},
					{x: 200, y: 120},
					{x: 70, y: 230},
				].map((n, k) => (
					<g key={k}>
						<rect x={n.x} y={n.y} width={140} height={84} rx={10} fill="#18181d" stroke={C.muted} strokeOpacity={0.6} strokeWidth={2} />
						<rect x={n.x + 16} y={n.y + 22} width={90} height={9} rx={4} fill={C.muted} opacity={0.7} />
						<rect x={n.x + 16} y={n.y + 46} width={60} height={9} rx={4} fill={C.muted} opacity={0.4} />
					</g>
				))}
			{i === 1 && (
				<>
					{DOTS.map((d, k) => (
						<circle key={k} cx={d.x} cy={d.y} r={5} fill={C.faint} />
					))}
					<circle cx={A_PT.x} cy={A_PT.y} r={26} fill="none" stroke={C.accent} strokeWidth={4} opacity={ring} />
				</>
			)}
			{i === 0 && (
				<>
					<circle cx={A_PT.x} cy={A_PT.y} r={32} fill={C.accent} />
					<circle cx={B_PT.x} cy={B_PT.y} r={32} fill={C.text} />
					<text transform={`translate(${A_PT.x} ${A_PT.y}) rotate(-45) scale(1 2)`} y={11} textAnchor="middle" fontFamily="Geist" fontWeight={700} fontSize={22} fill="#fff">A</text>
					<text transform={`translate(${B_PT.x} ${B_PT.y}) rotate(-45) scale(1 2)`} y={11} textAnchor="middle" fontFamily="Geist" fontWeight={700} fontSize={22} fill={C.bg}>B</text>
				</>
			)}
		</svg>
	</div>
);

const LayersInner: React.FC<SceneProps> = ({guides, vo}) => {
	const f = useCurrentFrame();
	const ys = YS.map((y, i) => nudge(f, 24, 80, SLAB - 6 * i, y));
	const drop = prog(f, 130, 20, (x) => x);
	const a = iso(A_PT);
	const lineTop = ys[0] + a.y + 17; // starts under A's disc (r 32, squashed to 16 by the tilt)
	const lineBot = ys[3] + a.y;
	const lineEnd = lineTop + (lineBot - lineTop) * drop;
	return (
		<>
			<Seam>
				<Head n="06" kicker="how it works" title="One graph, four layers." />
				{[3, 2, 1, 0].map((i) => (
					<Plane key={i} i={i} y={ys[i]} ring={lineEnd >= ys[1] + a.y ? 1 : 0} hit={drop >= 1 ? 1 : 0} />
				))}
				{/* The claim is an edge: A drops through the stack onto the file it holds. */}
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
					<line x1={CX + a.x} y1={lineTop} x2={CX + a.x} y2={lineEnd} stroke={C.accent} strokeWidth={4} opacity={f >= 130 ? 1 : 0} />
					{LAYERS.map((_, i) => (
						<line key={i} x1={CX + 269 + 10} y1={ys[i]} x2={CX + 269 + 52} y2={ys[i]} stroke={C.faint} strokeWidth={2} opacity={f >= SEP[i] ? 1 : 0} />
					))}
				</svg>
				{LAYERS.map((l, i) => (
					<div key={l.name} style={{position: 'absolute', left: CX + 269 + 70, top: ys[i] - 30, ...arrive(f, SEP[i], 5, 30)}}>
						<div style={{fontFamily: SANS, fontWeight: 600, fontSize: 40, letterSpacing: '-0.02em', color: i === 1 ? C.accent : C.text}}>{l.name}</div>
						<div style={{fontFamily: MONO, fontSize: 21, color: C.muted, marginTop: 2}}>{l.desc}</div>
					</div>
				))}
				<div style={{position: 'absolute', left: 160, top: 300, width: 600}}>
					<div style={{fontFamily: MONO, fontSize: 26, color: C.text, ...arrive(f, 152, 5, 30)}}>
						(:Agent)-[:<span style={{color: C.accent}}>CLAIMS</span>]-&gt;(:File)
					</div>
					<div style={{fontFamily: MONO, fontSize: 20, color: C.muted, marginTop: 8, ...arrive(f, 156, 5, 30)}}>
						a claim is just an edge in the graph
					</div>
					<div style={{fontFamily: SANS, fontWeight: 500, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1.15, color: C.text, marginTop: 64, ...arrive(f, 182, 6, 40)}}>
						Agents, claims, memory
						<br />
						and code live in one
						<br />
						<span style={{color: C.accent}}>FalkorDB</span> graph.
					</div>
					<div style={{fontFamily: MONO, fontSize: 22, color: C.muted, marginTop: 30, ...arrive(f, 214, 5, 30)}}>
						so a conflict check is one Cypher query
					</div>
				</div>
			</Seam>
			<VoCue show={guides} text={vo} />
		</>
	);
};

export const Layers = Interactive.create({Component: LayersInner, layout: 'absolute-fill'});

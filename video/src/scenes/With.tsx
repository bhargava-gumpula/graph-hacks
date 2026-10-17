import {Interactive, useCurrentFrame} from 'remotion';
import {AsciiRing} from '../Ascii';
import bench from '../../../bench/results.json';
import {CLAIMED, GraphView, NodeTag, PATH, WANTED, layoutGraph} from '../Graph';
import {C, E, MONO, SANS, arrive, clamp01, prog, typed} from '../theme';
import {Head, Seam, VoCue, useIsVertical, type SceneProps} from '../ui';

// Packet hops LoginForm -> login -> session (bench.conflict.path), impact, ASCII shockwave,
// then a beat of stillness (motion-doctrine: stillness before the climax), then the verdict.
// Two hops, timed so the impact lands on the same frame the three-hop cut did.
const FULL = {bTag: 16, query: 22, qcps: 3, hop: [62, 90], hopDur: 26, ring: 24, still: 16, reason: 22, coda: 50};
const FAST = {bTag: 4, query: 6, qcps: 4, hop: [28, 50], hopDur: 21, ring: 20, still: 13, reason: 20, coda: 999};

// The UPSTREAM part of conflictQuery(3) in packages/core/src/queries/conflict.ts (MATCH and the first WHERE terms).
const QUERY = ['MATCH p = (f:File {path: want})-[:IMPORTS*1..3]->(g:File),', '      (g)<-[c:CLAIMS]-(o:Agent) WHERE o.id <> $agent AND c.until > $now'];
const TRAIL = '.:-=+*#';

const WithInner: React.FC<SceneProps> = ({compact, guides, vo}) => {
	const f = useCurrentFrame();
	const v = useIsVertical();
	const g = layoutGraph(v);
	const T = compact ? FAST : FULL;
	const xs = PATH.map((id) => g.byId[id].x);
	const impact = T.hop[T.hop.length - 1] + T.hopDur;
	const verdict = impact + T.ring + T.still;

	// Packet position: one eased hop per import, a short lookup pause at each file.
	const px = (fr: number) => {
		let x = xs[0];
		T.hop.forEach((h, i) => {
			if (fr >= h) x = xs[i] + (xs[i + 1] - xs[i]) * prog(fr, h, T.hopDur, E.inOut);
		});
		return x;
	};
	const x = px(f);
	const speed = Math.abs(x - px(f - 1));
	const inFlight = f >= T.hop[0] && f < impact;
	// The orange stroke follows the packet exactly.
	const lit = T.hop.map((_, i) => i + 1).reduce((acc, hop) => acc + clamp01((x - (xs[hop - 1] + g.pillW / 2)) / (xs[hop] - xs[hop - 1] - g.pillW)), 0);
	const bump = (id: string) => {
		if (id === CLAIMED && f >= impact) return 0.22 * (1 - prog(f, impact, 12));
		const i = PATH.indexOf(id);
		const pass = i > 0 && i < PATH.length - 1 ? T.hop[i - 1] + T.hopDur : -1;
		return pass > 0 && f >= pass ? 0.1 * (1 - prog(f, pass, 8)) : 0;
	};
	const refused = f >= verdict;
	const ap = prog(f, verdict, 15, E.expo);
	const held = g.byId[CLAIMED];
	const trailLen = Math.min(16, Math.round(speed / 4));

	return (
		<>
			<Seam enter={!compact} exit={compact ? false : 'left'}>
				<Head n="05" kicker="with switchboard" title={v ? 'Every claim is checked.' : 'Every claim is checked against the graph.'} />
				<GraphView g={g} t={Infinity} dim={1} lit={lit} target={1} bump={bump} claimed={CLAIMED} />
				<NodeTag g={g} id={CLAIMED} text="A · claimed" color={C.accent} />
				<NodeTag
					g={g}
					id={WANTED}
					text={refused ? 'B · refused' : 'B · wants to edit'}
					color={refused ? '#2c2c33' : C.text}
					style={arrive(f, T.bTag, 5, 24)}
				/>
				{/* The packet and its ASCII wake: drawn only while it moves. */}
				{inFlight && (
					<>
						<div
							style={{
								position: 'absolute',
								left: x - 11,
								top: g.cy - 11,
								width: 22,
								height: 22,
								borderRadius: 11,
								background: '#fff',
								boxShadow: '0 0 26px 8px rgba(255,106,61,0.75)',
							}}
						/>
						<div
							style={{
								position: 'absolute',
								left: x - 16 - trailLen * 13.2,
								top: g.cy - 14,
								fontFamily: MONO,
								fontSize: 22,
								color: C.accent,
								whiteSpace: 'pre',
							}}
						>
							{Array.from({length: trailLen}, (_, i) => TRAIL[Math.floor((i / Math.max(1, trailLen)) * TRAIL.length)]).join('')}
						</div>
					</>
				)}
				{[0, 5].map((lag) => {
					const p = prog(f, impact + lag, T.ring, (q) => q);
					return (
						<AsciiRing key={lag} x={held.x} y={g.cy} r={(v ? 950 : 1250) * (1 - Math.pow(1 - p, 3))} band={80 - 40 * p} opacity={f >= impact + lag && p < 1 ? (lag ? 0.5 : 1) * (1 - p) : 0} />
					);
				})}
				{/* The query that decided it: the real conflict Cypher (conflictQuery(3), UPSTREAM part). */}
				<div style={{position: 'absolute', left: v ? 60 : 160, top: v ? 1400 : 942, fontFamily: MONO, fontSize: v ? 20 : 21, lineHeight: 1.45, whiteSpace: 'pre'}}>
					<div style={{color: C.muted}}>{typed(f, QUERY[0], T.query, T.qcps)}</div>
					<div style={{color: C.muted}}>{typed(f, QUERY[1], T.query + QUERY[0].length / T.qcps, T.qcps)}</div>
					<div style={{color: C.text, opacity: f >= impact ? 1 : 0}}>
						<span style={{color: C.accent}}>{bench.conflict.type}</span> · hops {bench.conflict.hops} · agent {bench.claim.agent} · {bench.checkMsMedian} ms
					</div>
				</div>
				{/* The verdict: inverse zoom-through arrival after the beat of stillness. */}
				<div
					style={{
						position: 'absolute',
						left: v ? 60 : 160,
						width: v ? 960 : 1600,
						top: v ? g.cy + 90 : undefined,
						bottom: v ? undefined : 44,
						boxSizing: 'border-box',
						padding: v ? '34px 40px' : '30px 48px',
						borderRadius: 22,
						background: C.bg,
						border: `1px solid ${C.line}`,
						opacity: refused ? 0.15 + 0.85 * ap : 0,
						scale: String(1.25 - 0.25 * ap),
						filter: `blur(${10 * (1 - ap)}px)`,
					}}
				>
					<div style={{display: 'flex', alignItems: 'baseline', gap: 28, flexWrap: 'wrap'}}>
						<span style={{fontFamily: SANS, fontWeight: 600, fontSize: v ? 104 : 96, letterSpacing: '-0.035em', color: C.text}}>Edit refused</span>
						<span style={{fontFamily: MONO, fontSize: v ? 44 : 40, color: C.accent}}>{v ? '' : '· '}
							{bench.conflict.hops} imports · {bench.checkMsMedian} ms
						</span>
					</div>
					<div style={{marginTop: 14, fontFamily: MONO, fontSize: v ? 22 : 22, color: C.muted, lineHeight: 1.5, ...arrive(f, verdict + T.reason, 5, 20)}}>
						reason: {PATH.slice(0, -1).map((p) => `${p} -> `).join('')}
						{v ? <br /> : null}
						<span style={{color: C.accent}}>
							{PATH[PATH.length - 1]} ({bench.claim.agent})
						</span>
					</div>
					{!compact && (
						<div style={{marginTop: 8, fontFamily: MONO, fontSize: 22, color: C.text, ...arrive(f, verdict + T.coda, 5, 20)}}>
							Refused before a single line was written.
						</div>
					)}
				</div>
			</Seam>
			<VoCue show={guides} text={vo} />
		</>
	);
};

export const With = Interactive.create({Component: WithInner, layout: 'absolute-fill'});

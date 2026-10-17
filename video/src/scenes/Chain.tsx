import {Interactive, useCurrentFrame} from 'remotion';
import bench from '../../../bench/results.json';
import {CLAIMED, GraphView, NodeTag, PATH, WANTED, buildCounts, layoutGraph} from '../Graph';
import {C, MONO, SANS, arrive, prog} from '../theme';
import {Head, Seam, VoCue, useIsVertical, type SceneProps} from '../ui';

const FULL = {build: 6, tags: 112, cap1: 124, dim: 160, hop: [168, 192], hopDur: 17, cap2: 226};
const FAST = {build: -10, tags: 44, cap1: 999, dim: 58, hop: [62, 76], hopDur: 13, cap2: 96};

const ChainInner: React.FC<SceneProps> = ({compact, guides, vo}) => {
	const f = useCurrentFrame();
	const v = useIsVertical();
	const g = layoutGraph(v);
	const T = compact ? FAST : FULL;
	const t = f - T.build;
	const {files, imports} = buildCounts(g, t, !!compact);
	const dim = prog(f, T.dim, 10);
	// Hops light one after another; each target node lights the frame its stroke arrives.
	const lit = T.hop.reduce((acc, h) => acc + prog(f, h, T.hopDur, (x) => x), 0);
	const bump = (id: string) => {
		const i = PATH.indexOf(id);
		if (i < 1) return 0;
		const arrival = T.hop[i - 1] + T.hopDur;
		return f >= arrival ? 0.12 * (1 - prog(f, arrival, 9)) : 0;
	};
	const capSize = v ? 46 : 40;
	return (
		<>
			<Seam enter={!compact}>
				<Head n="03" kicker="the hidden chain" title="The repo is a graph." />
				<div style={{position: 'absolute', inset: 0}}>
					<GraphView g={g} t={t} fast={compact} dim={dim} lit={lit} target={f >= T.tags ? 1 : 0} bump={bump} />
					<NodeTag g={g} id={CLAIMED} text="A · editing" color={C.accent} style={arrive(f, T.tags, 5, 24)} />
					<NodeTag g={g} id={WANTED} text="B · editing" color={C.text} style={arrive(f, T.tags + 3, 5, 24)} />
				</div>
				<div
					style={{
						position: 'absolute',
						left: v ? 80 : 160,
						top: v ? 1336 : 966,
						fontFamily: MONO,
						fontSize: v ? 26 : 22,
						color: C.muted,
						opacity: t >= 0 ? 1 : 0,
					}}
				>
					{files} files · {imports} imports · parsed from the demo repo
				</div>
				{!compact && (
					<div style={{position: 'absolute', right: 160, top: 954, fontFamily: SANS, fontSize: capSize, fontWeight: 500, color: C.muted, ...arrive(f, T.cap1, 5, 36)}}>
						{f < T.cap2 ? 'Different files. Different folders.' : ''}
					</div>
				)}
				<div
					style={{
						position: 'absolute',
						right: v ? undefined : 160,
						left: v ? 80 : undefined,
						top: v ? 1392 : 954,
						fontFamily: SANS,
						fontSize: v ? 60 : capSize,
						fontWeight: 600,
						letterSpacing: '-0.02em',
						color: C.text,
						...arrive(f, T.cap2, 6, 44),
					}}
				>
					{bench.conflict.hops} imports apart. <span style={{color: C.muted, fontWeight: 500}}>{v ? <br /> : null}A file lock sees nothing.</span>
				</div>
			</Seam>
			<VoCue show={guides} text={vo} />
		</>
	);
};

export const Chain = Interactive.create({Component: ChainInner, layout: 'absolute-fill'});

import {Interactive, useCurrentFrame} from 'remotion';
import {AsciiRing} from '../Ascii';
import {C, MONO, SANS, arrive, cascade, prog} from '../theme';
import {VoCue, type SceneProps} from '../ui';

// The film's last seam is the reserved upward vector (a conclusion rises): the benchmark exits up,
// and the wordmark keeps rising in as a waterfall, its letters split so the climax lasts longer.
const LETTERS = 'Switchboard'.split('');
const STARTS = cascade(0, LETTERS.length, 1.6);
const LAND = Math.round(STARTS[STARTS.length - 1] + 5);

const OutroInner: React.FC<SceneProps> = ({guides, vo}) => {
	const f = useCurrentFrame();
	const ring = prog(f, LAND, 30, (t) => t);
	return (
		<>
			<AsciiRing x={960} y={500} r={1300 * (1 - Math.pow(1 - ring, 4))} band={110 - 60 * ring} opacity={f >= LAND && ring < 1 ? 0.7 * (1 - ring) : 0} />
			<div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
				<div style={{fontFamily: SANS, fontWeight: 650, fontSize: 200, letterSpacing: '-0.05em', lineHeight: 1, color: C.text}}>
					{LETTERS.map((l, i) => (
						<span key={i} style={{display: 'inline-block', ...arrive(f, STARTS[i], 5 + i * 0.15, 60 + i * 4)}}>
							{l}
						</span>
					))}
				</div>
				<div style={{marginTop: 34, fontFamily: SANS, fontWeight: 500, fontSize: 48, color: C.muted, ...arrive(f, LAND + 6, 5, 40)}}>
					built on <span style={{color: C.text}}>FalkorDB</span>
				</div>
				<div style={{marginTop: 60, fontFamily: MONO, fontSize: 30, letterSpacing: '0.14em', color: C.accent, ...arrive(f, LAND + 14, 5, 30)}}>
					GRAPH HACKS 2026
				</div>
			</div>
			<VoCue show={guides} text={vo} />
		</>
	);
};

export const Outro = Interactive.create({Component: OutroInner, layout: 'absolute-fill'});

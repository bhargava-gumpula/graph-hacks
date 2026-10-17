import {Interactive, useCurrentFrame} from 'remotion';
import {C, MONO, SANS, arrive, cascade, typed} from '../theme';
import {Seam, VoCue, type SceneProps} from '../ui';

// Waterfall entry (cut-the-curve §6): anchors travel further and longer, the last word is split
// into fragments that travel furthest, and the gaps shrink so the line lands as one wave.
const WORDS: {w: string; line: 0 | 1; dist: number; dur: number}[] = [
	{w: 'Your', line: 0, dist: 46, dur: 4.5},
	{w: 'coding', line: 0, dist: 46, dur: 4.5},
	{w: 'agents', line: 0, dist: 72, dur: 6},
	{w: "can't", line: 1, dist: 46, dur: 4.5},
	{w: 'see', line: 1, dist: 46, dur: 4.5},
	{w: 'each', line: 1, dist: 46, dur: 4.5},
	{w: 'oth', line: 1, dist: 80, dur: 6},
	{w: 'er', line: 1, dist: 90, dur: 6},
	{w: '.', line: 1, dist: 40, dur: 3.5},
];
const STARTS = cascade(6, WORDS.length, 2.8);
/** Frame the headline lands; the root's ASCII texture ripples out from here. */
export const COLD_LAND = Math.round(STARTS[STARTS.length - 1] + 4);

const ColdOpenInner: React.FC<SceneProps> = ({guides, vo}) => {
	const f = useCurrentFrame();
	const word = (i: number) => {
		const {w, dist, dur} = WORDS[i];
		const glued = w === 'er' || w === '.';
		return (
			<span
				key={i}
				style={{
					display: 'inline-block',
					marginLeft: glued || i === 0 || i === 3 ? 0 : '0.24em',
					color: w === '.' ? C.accent : C.text,
					...arrive(f, STARTS[i], dur, dist),
				}}
			>
				{w}
			</span>
		);
	};
	const tag = (who: 'A' | 'B', file: string, start: number) => (
		<div style={{display: 'flex', alignItems: 'center', gap: 18, opacity: f >= start ? 1 : 0}}>
			<span style={{width: 14, height: 14, borderRadius: 7, background: who === 'A' ? C.accent : C.text}} />
			<span style={{color: C.text}}>agent {who}</span>
			<span style={{color: C.faint}}>-&gt;</span>
			<span>{typed(f, file, start + 4, 1.4)}</span>
		</div>
	);
	return (
		<>
			<Seam enter={false}>
				<div style={{position: 'absolute', left: 160, top: 300}}>
					<div style={{fontFamily: SANS, fontWeight: 600, fontSize: 132, letterSpacing: '-0.035em', lineHeight: 1.04}}>
						<div>{[0, 1, 2].map(word)}</div>
						<div>{[3, 4, 5, 6, 7, 8].map(word)}</div>
					</div>
					<div style={{marginTop: 64, fontFamily: MONO, fontSize: 32, color: C.muted, display: 'grid', gap: 16}}>
						{tag('A', 'editing lib/crypto.ts', 46)}
						{tag('B', 'editing ui/LoginForm.tsx', 62)}
					</div>
				</div>
			</Seam>
			<VoCue show={guides} text={vo} />
		</>
	);
};

export const ColdOpen = Interactive.create({Component: ColdOpenInner, layout: 'absolute-fill'});

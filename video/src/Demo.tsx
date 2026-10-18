import {AbsoluteFill, Audio, OffthreadVideo, Sequence, Track, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {AsciiField} from './Ascii';
import {Bench} from './scenes/Bench';
import {Chain} from './scenes/Chain';
import {ColdOpen} from './scenes/ColdOpen';
import {Outro} from './scenes/Outro';
import {With} from './scenes/With';
import {Without} from './scenes/Without';
import {Worktrees} from './scenes/Worktrees';
import {C, MONO, SANS, arrive} from './theme';
import {Head, Seam} from './ui';
import vo from './vo.json';

type Key = keyof typeof vo;
const FPS = 30;
const LEAD = 9; // frames of seam entry before the line starts
const TAIL = 12;
const TOUR_SECONDS = 26.6; // public/tour.mp4

// Scene order, with the shortest each scene may be (its animation needs that long).
const ORDER: {key: Key; min: number}[] = [
	{key: 'cold', min: 3.5},
	{key: 'worktrees', min: 9},
	{key: 'chain', min: 11},
	{key: 'without', min: 8},
	{key: 'with', min: 9.3},
	{key: 'demo', min: TOUR_SECONDS},
	{key: 'bench', min: 8},
	{key: 'install', min: 7},
	{key: 'outro', min: 6},
];

const PLAN = (() => {
	let from = 0;
	return ORDER.map(({key, min}) => {
		const dur = Math.max(Math.round(min * FPS), LEAD + Math.ceil(vo[key].seconds * FPS) + TAIL);
		const s = {key, from, dur};
		from += dur;
		return s;
	});
})();
export const DEMO_FRAMES = PLAN[PLAN.length - 1].from + PLAN[PLAN.length - 1].dur;
const at = (k: Key) => PLAN.find((p) => p.key === k)!;

/** Splits a line into caption chunks: sentences, packed by comma clauses up to 12 words. */
const chunks = (text: string) =>
	text.split(/(?<=[.?!])\s+/).flatMap((sentence) => {
		const out: string[] = [];
		for (const piece of sentence.split(/(?<=,)\s+/)) {
			const last = out[out.length - 1];
			if (last && (last + ' ' + piece).split(' ').length <= 12) out[out.length - 1] = last + ' ' + piece;
			else out.push(piece);
		}
		return out.flatMap((c) => {
			const w = c.split(' ');
			if (w.length <= 12) return [c];
			const half = Math.ceil(w.length / 2);
			return [w.slice(0, half).join(' '), w.slice(half).join(' ')];
		});
	});

/** Burned-in caption for one scene's line, timed by chunk length across the audio. */
const Caption: React.FC<{k: Key; band?: boolean}> = ({k, band}) => {
	const f = useCurrentFrame() - LEAD;
	const {text, seconds} = vo[k];
	const cs = chunks(text);
	const weights = cs.map((c) => c.length + 6);
	const total = weights.reduce((a, b) => a + b, 0);
	let t = 0;
	let cur = cs[cs.length - 1];
	for (let i = 0; i < cs.length; i++) {
		t += (weights[i] / total) * seconds * FPS;
		if (f < t) {
			cur = cs[i];
			break;
		}
	}
	if (f < 0) return null;
	return (
		<div style={{position: 'absolute', left: 0, right: 0, bottom: band ? 30 : 24, display: 'flex', justifyContent: 'center'}}>
			<div
				style={{
					maxWidth: 1500,
					padding: '12px 28px',
					borderRadius: 14,
					background: 'rgba(0,0,0,0.78)',
					fontFamily: SANS,
					fontWeight: 600,
					fontSize: 50,
					lineHeight: 1.25,
					color: '#fff',
					textAlign: 'center',
				}}
			>
				{cur}
			</div>
		</div>
	);
};

/** 06: the real guided tour on switchboard-agents.xyz, recorded with Playwright. */
const Tour: React.FC = () => {
	const {width} = useVideoConfig();
	const w = Math.round(width * 0.8);
	return (
		<Seam>
			<div style={{position: 'absolute', left: 160, top: 30, fontFamily: MONO, fontSize: 24, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted}}>
				<span style={{color: C.accent}}>06</span> &nbsp;live demo · switchboard-agents.xyz/app?tour=1
			</div>
			<div style={{position: 'absolute', left: (width - w) / 2, top: 76, width: w, height: (w * 9) / 16, borderRadius: 18, overflow: 'hidden', border: `1px solid ${C.line}`}}>
				<OffthreadVideo src={staticFile('tour.mp4')} muted style={{width: '100%', height: '100%'}} />
			</div>
		</Seam>
	);
};

const CMDS: {label: string; lines: string[]}[] = [
	{label: 'Claude Code', lines: ['/plugin marketplace add bhargava-gumpula/graph-hacks', '/plugin install switchboard@switchboard']},
	{label: 'or, from a clone', lines: ['npm run quickstart']},
];

/** 08: install card. */
export const Install: React.FC = () => {
	const f = useCurrentFrame();
	return (
		<Seam>
			<Head n="08" kicker="install" title="Two commands in Claude Code." />
			<div style={{position: 'absolute', left: 160, top: 300, display: 'flex', flexDirection: 'column', gap: 44}}>
				{CMDS.map((c, i) => (
					<div key={c.label} style={arrive(f, 8 + i * 14, 6, 40)}>
						<div style={{fontFamily: MONO, fontSize: 26, color: C.muted, letterSpacing: '0.04em', marginBottom: 14}}>{c.label}</div>
						<div style={{background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: '24px 36px'}}>
							{c.lines.map((l) => (
								<div key={l} style={{fontFamily: MONO, fontSize: 44, lineHeight: 1.6, color: C.text}}>
									<span style={{color: C.accent}}>&gt; </span>
									{l}
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</Seam>
	);
};

/** 1920x1080 hackathon demo: explainer scenes, the real tour footage, voiceover and captions. */
export const Demo: React.FC = () => (
	<AbsoluteFill style={{backgroundColor: C.bg}}>
		<AsciiField opacity={0.12} />
		{/* Scenes shrink toward the top so the captions below never cover their text. */}
		<AbsoluteFill style={{scale: 0.87, transformOrigin: '50% 0'}}>
		<Track name="Scenes">
			<ColdOpen name="Cold open" from={at('cold').from} durationInFrames={at('cold').dur} />
			<Worktrees name="Worktrees" from={at('worktrees').from} durationInFrames={at('worktrees').dur} />
			<Chain name="Hidden chain" from={at('chain').from} durationInFrames={at('chain').dur} />
			<Without name="Without" from={at('without').from} durationInFrames={at('without').dur} />
			<With name="With" from={at('with').from} durationInFrames={at('with').dur} />
			<Bench name="Benchmark" from={at('bench').from} durationInFrames={at('bench').dur} />
			<Outro name="Outro" from={at('outro').from} durationInFrames={at('outro').dur} />
		</Track>
		</AbsoluteFill>
		<Sequence name="Tour" from={at('demo').from} durationInFrames={at('demo').dur}>
			<Tour />
		</Sequence>
		<Sequence name="Install" from={at('install').from} durationInFrames={at('install').dur}>
			<Install />
		</Sequence>
		{PLAN.map((p) => (
			<Sequence key={p.key} name={`VO ${p.key}`} from={p.from} durationInFrames={p.dur}>
				<Sequence from={LEAD}>
					<Audio src={staticFile(`vo/${p.key}.wav`)} />
				</Sequence>
				<Caption k={p.key} band={p.key === 'demo'} />
			</Sequence>
		))}
	</AbsoluteFill>
);

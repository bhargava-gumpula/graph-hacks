import {AbsoluteFill, Audio, OffthreadVideo, Sequence, Track, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {AsciiField} from './Ascii';
import {Install} from './Demo';
import {Bench} from './scenes/Bench';
import {Outro} from './scenes/Outro';
import {With} from './scenes/With';
import {C, MONO, SANS, arrive} from './theme';
import live from './live.json';

// A real take, replayed: Claude Code (claude -p, stream-json) and Cursor (cursor-agent -p) on ~/switchboard-demo,
// the dashboard recorded headless with Playwright. Times come from the transcripts; idle stretches are compressed
// piecewise, never reordered. live.json comes from the take folder via scripts/live-prep.py <dir> src/live.json.

const FPS = 30;
const LEAD = 6;
const BREATH = 0.4;

// Voiceover clips (ElevenLabs, voice Eric) and their measured durations in seconds.
const VO = {
	title: {s: 8.219864, text: "Two coding agents, one repo. Neither can see what the other is changing, so one can quietly break the other's work through an import it never looked at."},
	claim: {s: 8.544943, text: 'This is a real take. Claude Code, on the left, is asked to change the session file. Its first edit claims that file, live in the FalkorDB graph.'},
	refuse: {s: 17.740045, text: 'Cursor, on the right, is asked for something else: the login form. A different file. But the login form imports the login API, which imports the session file. When Cursor claims its file, Switchboard walks that path and refuses, before Cursor writes a single line.'},
	wait: {s: 9.148662, text: 'The first claim wins. Cursor is now waiting, and Claude is never interrupted. Its next edit simply carries a note that someone is waiting on its file.'},
	free: {s: 11.192018, text: 'When Claude is done, it releases the file, and the graph marks it free. Cursor claims again, this time the claim goes through, and so does its edit. Neither agent ever wrote over the other.'},
	how: {s: 14.535692, text: "Under the hood, one graph holds the repo's imports and every agent's claims. Before each edit, a hook runs one Cypher query in FalkorDB: does an import path link this file to someone else's claim?"},
	bench: {s: 11.609977, text: 'We measured it. Ten runs, the same two edits, the real TypeScript compiler. Without Switchboard, ten of ten merged builds broke. With it, zero, and the median check takes 0.7 milliseconds.'},
	outro: {s: 4.87619, text: 'Two commands install it in Claude Code. Switchboard. Built on FalkorDB.'},
};
type Key = keyof typeof VO;
const len = (k: Key) => LEAD + Math.ceil((VO[k].s + BREATH) * FPS);

const INSTALL = 105;
const ORDER: {key: Key; dur: number}[] = [
	{key: 'title', dur: len('title')},
	{key: 'claim', dur: len('claim')},
	{key: 'refuse', dur: len('refuse')},
	{key: 'wait', dur: len('wait')},
	{key: 'free', dur: len('free')},
	{key: 'how', dur: len('how')},
	{key: 'bench', dur: len('bench')},
	{key: 'outro', dur: INSTALL + 165},
];
const PLAN = (() => {
	let from = 0;
	return ORDER.map(({key, dur}) => {
		const p = {key, from, dur};
		from += dur;
		return p;
	});
})();
const at = (k: Key) => PLAN.find((p) => p.key === k)!;
export const LIVE_FRAMES = PLAN[PLAN.length - 1].from + PLAN[PLAN.length - 1].dur;

// Take clock: frame (relative to the take's start) -> real epoch ms, piecewise linear through the anchors.
const A = live.anchors;
const retry = live.cursor.find((m) => m.k === 'ok')!.t + 2500; // Cursor's second claim goes through
const edited = live.cursor.find((m) => m.k === 'edit')!.t + 1500; // and its edit lands
const TAKE_FROM = at('claim').from;
const fr = (k: Key) => at(k).from - TAKE_FROM;
const KNOTS: [number, number][] = [
	[0, A.start],
	[fr('refuse'), A.cursor],
	[fr('wait'), A.refused],
	[fr('free'), A.released],
	[fr('free') + Math.round(at('free').dur * 0.4), retry],
	[fr('free') + Math.round(at('free').dur * 0.74), edited],
	[fr('free') + at('free').dur, A.end],
];
const TAKE_DUR = KNOTS[KNOTS.length - 1][0];
const realAt = (f: number) => interpolate(f, KNOTS.map((k) => k[0]), KNOTS.map((k) => k[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
const frameAt = (t: number) => interpolate(t, KNOTS.map((k) => k[1]), KNOTS.map((k) => k[0]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

type Msg = {t: number; k: string; s: string};
const clean = (s: string, max = 260) => {
	const t = s.replace(/```[\s\S]*/g, '').replace(/`/g, '').trim();
	return t.length > max ? t.slice(0, max - 1) + '…' : t;
};

/** Messages visible at frame f, newest at the bottom, each easing in on its own arrival frame. */
const useVisible = (msgs: Msg[]) => {
	const f = useCurrentFrame();
	const now = realAt(f);
	return msgs.filter((m) => m.t <= now).map((m) => ({m, age: f - frameAt(m.t)}));
};

const PANEL_TOP = 24;
const PANEL_H = 868;

const ClaudePanel: React.FC = () => {
	const vis = useVisible(live.claude as Msg[]);
	return (
		<div style={{position: 'absolute', left: 24, top: PANEL_TOP, width: 568, height: PANEL_H, background: '#0c0c0c', border: '1px solid #2b2b2b', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
			<div style={{padding: '14px 20px', borderBottom: '1px solid #262626', fontFamily: MONO, fontSize: 22, color: '#e8e8e8', display: 'flex', gap: 12, alignItems: 'center'}}>
				<span style={{color: '#d97757', fontSize: 26}}>✻</span> Claude Code <span style={{color: '#777', fontSize: 18}}>~/switchboard-demo · sonnet</span>
			</div>
			<div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '12px 18px', gap: 12, fontFamily: MONO, fontSize: 19, lineHeight: 1.38, overflow: 'hidden'}}>
				{vis.map(({m, age}, i) => {
					const st: React.CSSProperties = {opacity: Math.min(1, 0.2 + age / 6), translate: `0 ${Math.max(0, 10 - age * 2)}px`, whiteSpace: 'pre-wrap', wordBreak: 'break-word'};
					if (m.k === 'user') return <div key={i} style={{...st, background: '#1f1f1f', borderLeft: '3px solid #777', padding: '8px 12px', color: '#cfcfcf'}}>&gt; {m.s}</div>;
					if (m.k === 'tool') return <div key={i} style={{...st, color: '#f0f0f0'}}><span style={{color: '#d97757'}}>⏺</span> {m.s}</div>;
					if (m.k === 'ok') return <div key={i} style={{...st, color: '#7fd18b', paddingLeft: 22}}>{m.s}</div>;
					if (m.k === 'notice') return <div key={i} style={{...st, color: '#f5c76b', background: 'rgba(245,199,107,0.08)', border: '1px solid rgba(245,199,107,0.35)', borderRadius: 8, padding: '8px 12px'}}>{clean(m.s, 400)}</div>;
					return <div key={i} style={{...st, color: '#e8e8e8'}}><span style={{color: '#e8e8e8'}}>⏺</span> {clean(m.s)}</div>;
				})}
			</div>
		</div>
	);
};

const CursorPanel: React.FC = () => {
	const vis = useVisible(live.cursor as Msg[]);
	return (
		<div style={{position: 'absolute', right: 24, top: PANEL_TOP, width: 568, height: PANEL_H, background: '#181818', border: '1px solid #2e2e2e', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
			<div style={{padding: '14px 20px', borderBottom: '1px solid #2a2a2a', fontFamily: SANS, fontSize: 22, fontWeight: 600, color: '#e6e6e6', display: 'flex', gap: 12, alignItems: 'center'}}>
				<span style={{display: 'inline-block', width: 20, height: 20, background: 'linear-gradient(135deg,#fff,#888)', clipPath: 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)'}} /> Cursor <span style={{color: '#8a8a8a', fontSize: 18, fontWeight: 400}}>Agent · cursor-agent CLI</span>
			</div>
			<div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '12px 18px', gap: 10, fontFamily: SANS, fontSize: 20, lineHeight: 1.4, overflow: 'hidden'}}>
				{vis.map(({m, age}, i) => {
					const st: React.CSSProperties = {opacity: Math.min(1, 0.2 + age / 6), translate: `0 ${Math.max(0, 10 - age * 2)}px`, whiteSpace: 'pre-wrap', wordBreak: 'break-word'};
					if (m.k === 'user') return <div key={i} style={{...st, alignSelf: 'flex-end', maxWidth: '88%', background: '#2c2c2c', borderRadius: 12, padding: '10px 14px', color: '#f2f2f2'}}>{m.s}</div>;
					if (m.k === 'tool') return <div key={i} style={{...st, fontFamily: MONO, fontSize: 16, color: '#9a9a9a'}}>◦ {m.s}</div>;
					if (m.k === 'edit') return <div key={i} style={{...st, fontFamily: MONO, fontSize: 19, color: '#7fd18b', background: 'rgba(127,209,139,0.08)', borderRadius: 8, padding: '6px 10px'}}>{m.s}</div>;
					if (m.k === 'deny') return <div key={i} style={{...st, fontFamily: MONO, fontSize: 17, color: '#ffb4a8', background: 'rgba(229,72,77,0.14)', border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 12px'}}>{m.s}</div>;
					if (m.k === 'ok') return <div key={i} style={{...st, fontFamily: MONO, fontSize: 17, color: '#7fd18b', background: 'rgba(127,209,139,0.08)', border: '1px solid rgba(127,209,139,0.4)', borderRadius: 8, padding: '8px 12px'}}>{m.s}</div>;
					return <div key={i} style={{...st, color: '#dcdcdc'}}>{clean(m.s)}</div>;
				})}
			</div>
		</div>
	);
};

/** One crop of the headless dashboard recording, driven by the take clock piece by piece. */
const Crop: React.FC<{x: number; y: number; w: number; h: number; scale: number; label: string}> = ({x, y, w, h, scale, label}) => (
	<div style={{position: 'relative', width: w * scale, height: h * scale, overflow: 'hidden', borderRadius: 12, border: `1px solid ${C.line}`, background: '#0a0a0a'}}>
		{KNOTS.slice(1).map(([f1, r1], i) => {
			const [f0, r0] = KNOTS[i];
			const rate = (r1 - r0) / 1000 / ((f1 - f0) / FPS);
			return (
				<Sequence key={i} from={f0} durationInFrames={f1 - f0} layout="none">
					<OffthreadVideo
						src={staticFile('live/dashboard.mp4')}
						muted
						trimBefore={Math.max(0, Math.round(((r0 - live.t0) / 1000) * FPS))}
						playbackRate={rate}
						style={{position: 'absolute', left: -x * scale, top: -y * scale, width: 1920 * scale, height: 1080 * scale, maxWidth: 'none'}}
					/>
				</Sequence>
			);
		})}
		<div style={{position: 'absolute', left: 10, bottom: 8, fontFamily: MONO, fontSize: 15, letterSpacing: '0.06em', color: C.muted, background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: 6}}>{label}</div>
	</div>
);

const Take: React.FC = () => {
	const f = useCurrentFrame();
	const secs = Math.max(0, (realAt(f) - A.start) / 1000);
	return (
		<AbsoluteFill style={{backgroundColor: C.bg}}>
			<ClaudePanel />
			<CursorPanel />
			<div style={{position: 'absolute', left: 608, top: PANEL_TOP, width: 704, display: 'flex', flexDirection: 'column', gap: 12}}>
				<Crop x={330} y={70} w={1130} h={760} scale={704 / 1130} label="LIVE DASHBOARD · FalkorDB Cloud graph" />
				<Crop x={1545} y={99} w={370} h={200} scale={704 / 370} label="FEED" />
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: PANEL_TOP + PANEL_H + 8, textAlign: 'center', fontFamily: MONO, fontSize: 18, color: C.muted}}>
				Real Claude Code and Cursor (cursor-agent CLI) sessions, replayed from their transcripts · take clock {Math.floor(secs / 60)}:{String(Math.floor(secs % 60)).padStart(2, '0')}
			</div>
		</AbsoluteFill>
	);
};

const Title: React.FC = () => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{justifyContent: 'center', paddingLeft: 160}}>
			<div style={{fontFamily: MONO, fontSize: 26, letterSpacing: '0.1em', color: C.accent, ...arrive(f, 4)}}>LIVE DEMO · SWITCHBOARD</div>
			<div style={{marginTop: 28, fontFamily: SANS, fontWeight: 650, fontSize: 110, letterSpacing: '-0.04em', lineHeight: 1.02, color: C.text, ...arrive(f, 10, 6, 50)}}>
				Two coding agents.
				<br />
				One repo.
			</div>
			<div style={{marginTop: 36, fontFamily: SANS, fontSize: 46, color: C.muted, maxWidth: 1400, ...arrive(f, 40, 6, 40)}}>
				Neither can see what the other is changing.
			</div>
		</AbsoluteFill>
	);
};

/** Caption groups of 4 to 8 words, split at clause boundaries first. */
const groups = (text: string) => {
	const out: string[] = [];
	for (const clause of text.split(/(?<=[.?!,:])\s+/)) {
		const w = clause.split(/\s+/);
		const n = Math.ceil(w.length / 8);
		const size = Math.ceil(w.length / n);
		for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(' '));
	}
	// Fold groups under 4 words into a neighbour when the result stays at 8 words or fewer.
	const merged: string[] = [];
	for (const g of out) {
		const last = merged[merged.length - 1];
		const wc = (s: string) => s.split(' ').length;
		if (last && (wc(g) < 4 || wc(last) < 4) && wc(last) + wc(g) <= 8) merged[merged.length - 1] = last + ' ' + g;
		else merged.push(g);
	}
	return merged;
};

const Caption: React.FC<{k: Key}> = ({k}) => {
	const f = useCurrentFrame() - LEAD;
	if (f < 0) return null;
	const gs = groups(VO[k].text);
	const weights = gs.map((g) => g.length + 4);
	const total = weights.reduce((a, b) => a + b, 0);
	let t = 0;
	let cur: string | null = null;
	for (let i = 0; i < gs.length; i++) {
		t += (weights[i] / total) * VO[k].s * FPS;
		if (f < t) {
			cur = gs[i];
			break;
		}
	}
	if (!cur) return null;
	return (
		<div style={{position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center'}}>
			<div style={{maxWidth: 1600, padding: '12px 30px', borderRadius: 14, background: 'rgba(0,0,0,0.74)', fontFamily: SANS, fontWeight: 600, fontSize: 44, lineHeight: 1.25, color: '#fff', textAlign: 'center'}}>{cur}</div>
		</div>
	);
};

const voOn = (f: number) => PLAN.some((p) => f >= p.from + LEAD && f < p.from + LEAD + VO[p.key].s * FPS);

/** 1920x1080 live demo: a real Claude Code + Cursor take, replayed, with narration and captions. */
export const Live: React.FC = () => (
	<AbsoluteFill style={{backgroundColor: C.bg}}>
		<AsciiField opacity={0.1} />
		<Sequence name="Title" from={at('title').from} durationInFrames={at('title').dur}>
			<Title />
		</Sequence>
		<Sequence name="Take" from={TAKE_FROM} durationInFrames={TAKE_DUR}>
			<Take />
		</Sequence>
		<AbsoluteFill style={{scale: 0.87, transformOrigin: '50% 0'}}>
			<Track name="Scenes">
				<With name="How it works" from={at('how').from} durationInFrames={at('how').dur} />
				<Bench name="Benchmark" from={at('bench').from} durationInFrames={at('bench').dur} />
				<Outro name="Outro" from={at('outro').from + INSTALL} durationInFrames={at('outro').dur - INSTALL} />
			</Track>
		</AbsoluteFill>
		<Sequence name="Install" from={at('outro').from} durationInFrames={INSTALL}>
			<Install />
		</Sequence>
		<Audio src={staticFile('live/pad.mp3')} volume={(f) => (voOn(f) ? 0.5 : 1)} />
		{PLAN.map((p) => (
			<Sequence key={p.key} name={`VO ${p.key}`} from={p.from} durationInFrames={p.dur}>
				<Sequence from={LEAD}>
					<Audio src={staticFile(`live/${p.key}.mp3`)} />
				</Sequence>
				<Caption k={p.key} />
			</Sequence>
		))}
	</AbsoluteFill>
);

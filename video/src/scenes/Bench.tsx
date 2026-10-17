import type React from 'react';
import {Interactive, useCurrentFrame} from 'remotion';
import bench from '../../../bench/results.json';
import {C, MONO, SANS, arrive} from '../theme';
import {Head, Seam, VoCue, type SceneProps} from '../ui';

// bench/results.json: scripted agents, same edit, real tsc, real FalkorDB conflict check.
const N = bench.n;
const TICK = 6;
const LEFT_AT = 34;
const RIGHT_AT = 104;

const Side: React.FC<{
	x: number;
	f: number;
	at: number;
	label: string;
	accent: boolean;
	big: string;
	sub: string;
	filled: number;
	mark: string;
	note: string;
}> = ({x, f, at, label, accent, big, sub, filled, mark, note}) => (
	<div style={{position: 'absolute', left: x, top: 270, width: 720, ...arrive(f, at - 10, 6, 40)}}>
		<div style={{fontFamily: MONO, fontSize: 26, color: accent ? C.accent : C.muted, letterSpacing: '0.04em'}}>{label}</div>
		<div style={{fontFamily: SANS, fontWeight: 600, fontSize: 210, letterSpacing: '-0.05em', lineHeight: 1, marginTop: 18, color: C.text, fontVariantNumeric: 'tabular-nums'}}>
			{big}
		</div>
		<div style={{fontFamily: SANS, fontSize: 40, fontWeight: 500, color: C.muted, marginTop: 6}}>{sub}</div>
		<div style={{display: 'flex', gap: 12, marginTop: 44}}>
			{Array.from({length: N}, (_, i) => (
				<div
					key={i}
					style={{
						width: 56,
						height: 56,
						borderRadius: 10,
						boxSizing: 'border-box',
						border: `2px solid ${i < filled ? (accent ? C.accent : C.text) : C.faint}`,
						background: i < filled ? (accent ? C.accent : C.text) : 'transparent',
						color: accent ? '#fff' : C.bg,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontFamily: MONO,
						fontSize: 28,
						fontWeight: 700,
						scale: String(i < filled ? 1 + 0.12 * Math.max(0, 1 - (f - at - i * TICK) / 4) : 1),
					}}
				>
					{i < filled ? mark : ''}
				</div>
			))}
		</div>
		<div style={{fontFamily: MONO, fontSize: 24, color: accent ? C.text : C.muted, marginTop: 28, opacity: filled >= N ? 1 : 0}}>{note}</div>
	</div>
);

const BenchInner: React.FC<SceneProps> = ({guides, vo}) => {
	const f = useCurrentFrame();
	// Each tick fills one square and moves the counter on the same frame.
	const broke = Math.max(0, Math.min(bench.without.brokenBuilds, Math.floor((f - LEFT_AT) / TICK) + 1));
	const blocked = Math.max(0, Math.min(bench.with.blocked, Math.floor((f - RIGHT_AT) / TICK) + 1));
	return (
		<>
			<Seam exit="up">
				<Head n="07" kicker="benchmark" title="Same edit. Ten runs. Real tsc." />
				<Side
					x={160}
					f={f}
					at={LEFT_AT}
					label="file locks only"
					accent={false}
					big={`${broke}/${N}`}
					sub="builds broke"
					filled={broke}
					mark="✕"
					note={`${bench.without.editsApplied}/${N} edits applied, then tsc failed`}
				/>
				<Side
					x={1040}
					f={f}
					at={RIGHT_AT}
					label="with switchboard"
					accent
					big={`${bench.with.brokenBuilds}/${N}`}
					sub={`builds broke · ${blocked}/${N} edits refused`}
					filled={blocked}
					mark=""
					note={`median check ${bench.checkMsMedian} ms`}
				/>
				<div style={{position: 'absolute', left: 160, top: 960, fontFamily: MONO, fontSize: 22, color: C.muted, ...arrive(f, 176, 5, 24)}}>
					{bench.kind} · tsc {bench.tsc.replace('Version ', '')}
				</div>
			</Seam>
			<VoCue show={guides} text={vo} />
		</>
	);
};

export const Bench = Interactive.create({Component: BenchInner, layout: 'absolute-fill'});

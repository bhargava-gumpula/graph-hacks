import type React from 'react';
import {Interactive, useCurrentFrame} from 'remotion';
import {C, MONO, SANS, arrive, cascade, prog, typed} from '../theme';
import {Head, Seam, VoCue, type SceneProps} from '../ui';

type Line = {at: number; text: string; kind: 'cmd' | 'out' | 'minus' | 'plus' | 'ok'};

const A: Line[] = [
	{at: 12, text: 'git worktree add ../wt-a', kind: 'cmd'},
	{at: 40, text: 'agent-a "make password hashing async"', kind: 'cmd'},
	{at: 92, text: 'read   lib/crypto.ts', kind: 'out'},
	{at: 102, text: 'edit   lib/crypto.ts', kind: 'out'},
	{at: 112, text: '- hashPassword(p): string', kind: 'minus'},
	{at: 116, text: '+ async hashPassword(p): Promise<string>', kind: 'plus'},
	{at: 146, text: 'tsc    0 errors', kind: 'ok'},
	{at: 214, text: 'git commit -am "async hashing"', kind: 'cmd'},
];
const B: Line[] = [
	{at: 22, text: 'git worktree add ../wt-b', kind: 'cmd'},
	{at: 56, text: 'agent-b "tidy up the login form"', kind: 'cmd'},
	{at: 100, text: 'read   ui/LoginForm.tsx', kind: 'out'},
	{at: 110, text: 'edit   ui/LoginForm.tsx', kind: 'out'},
	{at: 122, text: '+ const who = mark || user.email;', kind: 'plus'},
	{at: 154, text: 'tsc    0 errors', kind: 'ok'},
	{at: 226, text: 'git commit -am "tidy login"', kind: 'cmd'},
];

const Terminal: React.FC<{who: 'A' | 'B'; lines: Line[]; f: number; x: number}> = ({who, lines, f, x}) => (
	<div
		style={{
			position: 'absolute',
			left: x,
			top: 290,
			width: 760,
			height: 540,
			borderRadius: 18,
			background: C.panel,
			border: `1px solid ${C.line}`,
			overflow: 'hidden',
		}}
	>
		<div
			style={{
				height: 52,
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				padding: '0 22px',
				borderBottom: `1px solid ${C.line}`,
				fontFamily: MONO,
				fontSize: 20,
				color: C.muted,
			}}
		>
			{[0, 1, 2].map((i) => (
				<span key={i} style={{width: 12, height: 12, borderRadius: 6, background: '#2a2a31'}} />
			))}
			<span style={{marginLeft: 14, display: 'flex', alignItems: 'center', gap: 10}}>
				<span style={{width: 10, height: 10, borderRadius: 5, background: who === 'A' ? C.accent : C.text}} />
				agent {who} · ~/wt-{who.toLowerCase()} · main@3f9c2e1
			</span>
		</div>
		<div style={{padding: '22px 28px', fontFamily: MONO, fontSize: 24, lineHeight: '44px'}}>
			{lines
				.filter((l) => f >= l.at)
				.map((l) => {
					const isCmd = l.kind === 'cmd';
					const shown = isCmd ? typed(f, l.text, l.at + 2, 1.7) : l.text;
					const typing = isCmd && shown.length < l.text.length;
					const color = {cmd: C.text, out: C.muted, minus: '#6b6b75', plus: C.text, ok: C.text}[l.kind];
					return (
						<div key={l.at} style={{color, whiteSpace: 'pre'}}>
							{isCmd ? <span style={{color: C.muted}}>$ </span> : l.kind === 'ok' ? <span>✓ </span> : '  '}
							{shown}
							{typing ? <span style={{background: C.text, color: C.bg}}> </span> : null}
						</div>
					);
				})}
		</div>
	</div>
);

const WALL_ROWS = 27;
const CAPTION = ['Both', 'builds', 'green.', 'Neither', 'can', 'see', 'the', 'other.'];
const CAP_STARTS = cascade(180, CAPTION.length, 2.6);

const WorktreesInner: React.FC<SceneProps> = ({guides, vo}) => {
	const f = useCurrentFrame();
	const wall = prog(f, 170, 14);
	return (
		<>
			<Seam>
				<Head n="02" kicker="two agents, two worktrees" title="Each agent sees a clean repo." />
				<Terminal who="A" lines={A} f={f} x={160} />
				<Terminal who="B" lines={B} f={f} x={1000} />
				{/* The wall between them: a column of ASCII that drops like a shutter. */}
				<pre
					style={{
						position: 'absolute',
						left: 942,
						top: 290,
						margin: 0,
						fontFamily: MONO,
						fontSize: 20,
						lineHeight: '20px',
						color: C.muted,
						opacity: 0.8,
					}}
				>
					{Array.from({length: Math.round(WALL_ROWS * wall)}, (_, i) => '#:|'[i % 3].repeat(3)).join('\n')}
				</pre>
				<div style={{position: 'absolute', left: 160, top: 900, fontFamily: SANS, fontWeight: 500, fontSize: 48, letterSpacing: '-0.02em'}}>
					{CAPTION.map((w, i) => (
						<span
							key={w + i}
							style={{display: 'inline-block', marginRight: '0.26em', color: i < 3 ? C.text : C.muted, ...arrive(f, CAP_STARTS[i], 5, 40)}}
						>
							{w}
						</span>
					))}
				</div>
			</Seam>
			<VoCue show={guides} text={vo} />
		</>
	);
};

export const Worktrees = Interactive.create({Component: WorktreesInner, layout: 'absolute-fill'});

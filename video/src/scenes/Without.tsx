import type React from 'react';
import {Interactive, useCurrentFrame} from 'remotion';
import {C, E, MONO, SANS, arrive, prog, typed} from '../theme';
import {Head, Seam, VoCue, useIsVertical, type SceneProps} from '../ui';

const FULL = {rows: [14, 24, 46, 56], tsc: 76, bar: 86, barDur: 20, card: 120, cap: 160, why: 196};
const FAST = {rows: [4, 9, 15, 20], tsc: 26, bar: 32, barDur: 14, card: 56, cap: 82, why: 999};

const ROWS: [string, string, string, string][] = [
	['lock', 'lib/crypto.ts', 'A', 'granted'],
	['lock', 'ui/LoginForm.tsx', 'B', 'granted'],
	['merge', 'wt-a -> main', '', 'clean'],
	['merge', 'wt-b -> main', '', 'clean'],
];

/** Real tsc 5.9.3 output from merging both branches of the demo repo. */
const ErrorCard: React.FC<{v: boolean; style: React.CSSProperties}> = ({v, style}) => {
	const fs = v ? 26 : 22;
	return (
		<div style={{borderRadius: 16, overflow: 'hidden', background: C.paper, color: C.ink, fontFamily: MONO, fontSize: fs, boxShadow: '0 30px 80px rgba(0,0,0,0.5)', ...style}}>
			<div style={{background: C.red, color: '#fff', display: 'flex', justifyContent: 'space-between', padding: '14px 30px', fontWeight: 700}}>
				<span>✕ error TS2345</span>
				<span style={{fontWeight: 500, opacity: 0.85}}>tsc 5.9.3</span>
			</div>
			<div style={{padding: '26px 30px 24px', lineHeight: 1.5}}>
				<div style={{fontWeight: 700}}>ui/LoginForm.tsx(9,36)</div>
				<div>Argument of type &apos;Promise&lt;LoginResult&gt;&apos; is not</div>
				<div>assignable to parameter of type &apos;LoginResult&apos;.</div>
				<div style={{marginTop: 18, background: '#e6e6ea', borderRadius: 10, padding: '14px 18px', whiteSpace: 'pre'}}>
					<span style={{color: '#8a8a94'}}>9 │ </span>
					return who + &quot; &quot; + loginHeadline(
					<span style={{textDecoration: `underline wavy ${C.red}`, textUnderlineOffset: 6, textDecorationThickness: 2}}>result</span>);
				</div>
				<div style={{marginTop: 16, color: '#71717a'}}>Found 1 error in ui/LoginForm.tsx:9</div>
			</div>
		</div>
	);
};

const WithoutInner: React.FC<SceneProps> = ({compact, guides, vo}) => {
	const f = useCurrentFrame();
	const v = useIsVertical();
	const T = compact ? FAST : FULL;
	const fs = v ? 28 : 26;
	const bar = prog(f, T.bar, T.barDur, (x) => x);
	const failed = f >= T.card;
	// Inverse zoom-through arrival (cut-the-curve §2): the result lands oversized and retracts.
	const ap = prog(f, T.card, 15, E.expo);
	return (
		<>
			<Seam exit={'left'}>
				<Head n="04" kicker="without switchboard" title={v ? 'File locks say yes.' : 'File locks say yes. The build says no.'} />
				<div style={{position: 'absolute', left: v ? 80 : 160, top: v ? 440 : 300, fontFamily: MONO, fontSize: fs, lineHeight: v ? '58px' : '56px'}}>
					{ROWS.map(([verb, what, who, res], i) => (
						<div key={i} style={{display: 'grid', gridTemplateColumns: v ? '120px 330px 46px auto' : '130px 330px 46px auto', ...arrive(f, T.rows[i], 5, 28)}}>
							<span style={{color: C.muted}}>{verb}</span>
							<span style={{color: C.text}}>{what}</span>
							<span style={{color: who === 'A' ? C.accent : C.text}}>{who}</span>
							<span style={{color: C.muted}}>
								<span style={{color: C.text}}>✓</span> {res}
							</span>
						</div>
					))}
					<div style={{marginTop: 20, color: C.text, opacity: f >= T.tsc ? 1 : 0}}>
						<span style={{color: C.muted}}>$ </span>
						{typed(f, 'tsc --noEmit', T.tsc + 1, 1.8)}
					</div>
					<div style={{color: C.muted, opacity: f >= T.bar ? 1 : 0, whiteSpace: 'pre'}}>
						[{'#'.repeat(Math.round(bar * 18)).padEnd(18, '.')}] {Math.round(bar * 35)}/35 files
					</div>
					<div style={{color: C.red, fontWeight: 600, opacity: failed ? 1 : 0}}>✕ exit code 2</div>
				</div>
				<ErrorCard
					v={v}
					style={{
						position: 'absolute',
						left: v ? 60 : 960,
						top: v ? 900 : 300,
						width: v ? 960 : 800,
						opacity: failed ? 0.15 + 0.85 * ap : 0,
						scale: String(1.25 - 0.25 * ap),
						filter: `blur(${10 * (1 - ap)}px)`,
					}}
				/>
				<div style={{position: 'absolute', left: v ? 80 : 160, top: v ? 1420 : 900, fontFamily: SANS, fontSize: v ? 52 : 48, fontWeight: 600, letterSpacing: '-0.02em', color: C.text, ...arrive(f, T.cap, 6, 40)}}>
					Both branches green.{v ? <br /> : ' '}
					<span style={{color: C.red}}>The merge is red.</span>
				</div>
				<div style={{position: 'absolute', left: 160, top: 978, fontFamily: MONO, fontSize: 24, color: C.muted, ...arrive(f, T.why, 5, 30)}}>
					lib/crypto.ts changed a return type, three imports away from ui/LoginForm.tsx
				</div>
			</Seam>
			<VoCue show={guides} text={vo} />
		</>
	);
};

export const Without = Interactive.create({Component: WithoutInner, layout: 'absolute-fill'});

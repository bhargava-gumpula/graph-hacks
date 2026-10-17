import type React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, E, MONO, SANS, clamp01} from './theme';

export type SceneProps = {
	/** Shorter beat table, used by the vertical Short. */
	readonly compact?: boolean;
	/** Show the voiceover cue strip. */
	readonly guides?: boolean;
	/** Draft voiceover line for this scene (shown when `guides` is on). */
	readonly vo?: string;
};

export const useIsVertical = () => {
	const {width, height} = useVideoConfig();
	return height > width;
};

/**
 * cut-the-curve seam (motion-doctrine): the scene enters mid-flight from +12% of the frame
 * on power4.out and exits on power4.in in the film's current (left, or up for the finale),
 * so velocity matches across every cut and only one side is visible per frame.
 */
export const Seam: React.FC<{
	children: React.ReactNode;
	enter?: boolean;
	exit?: false | 'left' | 'up';
}> = ({children, enter = true, exit = 'left'}) => {
	const f = useCurrentFrame();
	const {durationInFrames: d, width} = useVideoConfig();
	const travel = Math.round(width * 0.12);
	const dur = 10;
	let x = 0;
	let y = 0;
	let o = 1;
	if (enter && f < dur) {
		const p = f / dur;
		x = travel * (1 - E.out(p));
		o = 0.35 + 0.65 * clamp01(p / 0.5);
	}
	if (exit && f >= d - dur) {
		const p = (f - (d - dur)) / dur;
		const v = -travel * E.in(p);
		if (exit === 'left') x = v;
		else y = v;
		o = 1 - p;
	}
	return <AbsoluteFill style={{translate: `${x}px ${y}px`, opacity: o}}>{children}</AbsoluteFill>;
};

/** Scene kicker + title, top-left. Visible from frame 0 so the seam has a carrier. */
export const Head: React.FC<{n: string; kicker: string; title: string}> = ({n, kicker, title}) => {
	const v = useIsVertical();
	return (
		<div style={{position: 'absolute', left: v ? 80 : 160, top: v ? 170 : 64, maxWidth: v ? 920 : 1600}}>
			<div style={{fontFamily: MONO, fontSize: v ? 28 : 24, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted}}>
				<span style={{color: C.accent}}>{n}</span> &nbsp;{kicker}
			</div>
			<div
				style={{
					fontFamily: SANS,
					fontWeight: 600,
					fontSize: v ? 84 : 68,
					letterSpacing: '-0.03em',
					lineHeight: 1.05,
					color: C.text,
					marginTop: v ? 18 : 14,
				}}
			>
				{title}
			</div>
		</div>
	);
};

/** Placeholder strip marking where the owner's voiceover line goes. */
export const VoCue: React.FC<{text?: string; show?: boolean}> = ({text, show}) => {
	const v = useIsVertical();
	if (!show || !text) return null;
	return (
		<div
			style={{
				position: 'absolute',
				left: v ? 80 : 160,
				right: v ? 80 : 160,
				bottom: v ? 60 : 22,
				display: 'flex',
				gap: 14,
				alignItems: 'center',
				fontFamily: MONO,
				fontSize: 19,
				color: C.muted,
				opacity: 0.85,
			}}
		>
			<span style={{border: `1px solid ${C.faint}`, borderRadius: 4, padding: '1px 7px', fontSize: 15, letterSpacing: '0.1em'}}>VO</span>
			<span>{text}</span>
		</div>
	);
};

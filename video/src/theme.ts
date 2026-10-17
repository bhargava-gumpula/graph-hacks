import type React from 'react';
import {loadFont} from '@remotion/fonts';
import {Easing} from 'remotion';
import geist from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2';
import geistMono from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2';

loadFont({family: 'Geist', url: geist, weight: '100 900'});
loadFont({family: 'Geist Mono', url: geistMono, weight: '100 900'});

export const C = {
	bg: '#0b0b0d',
	text: '#ededf0',
	muted: '#8b8b96',
	accent: '#ff6a3d',
	panel: '#111114',
	line: '#26262d',
	faint: '#3a3a43',
	red: '#e5484d',
	paper: '#f4f4f5',
	ink: '#18181b',
};

export const SANS = 'Geist, sans-serif';
export const MONO = '"Geist Mono", monospace';

// GSAP power4 is a quintic; expo.out for arrivals.
export const E = {
	out: Easing.out(Easing.poly(5)),
	in: Easing.in(Easing.poly(5)),
	in3: Easing.in(Easing.poly(4)),
	expo: Easing.out(Easing.exp),
	inOut: Easing.inOut(Easing.cubic),
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Eased 0..1 progress between two frames. */
export const prog = (f: number, f0: number, dur: number, ease: (t: number) => number = E.out) =>
	ease(clamp01((f - f0) / dur));

/** cut-the-curve §7: slow-fast-slow group slide (10/65/25 distance over 20/18/62 time). */
export const nudge = (f: number, f0: number, dur: number, a: number, b: number) => {
	const t1 = f0 + dur * 0.2;
	const t2 = t1 + dur * 0.18;
	const d = b - a;
	if (f <= t1) return a + d * 0.1 * E.in3(clamp01((f - f0) / (t1 - f0)));
	if (f <= t2) return a + d * (0.1 + 0.65 * ((f - t1) / (t2 - t1)));
	return a + d * (0.75 + 0.25 * E.out(clamp01((f - t2) / (f0 + dur - t2))));
};

/** cut-the-curve §6 waterfall entry: binary opacity, rise from below. */
export const arrive = (f: number, start: number, dur = 5, dist = 44): React.CSSProperties => ({
	opacity: f >= start ? 1 : 0,
	translate: `0px ${(1 - prog(f, start, dur)) * dist}px`,
});

/** Start frames for a cascade whose gaps shrink by 0.84 each step. */
export const cascade = (start: number, n: number, gap0: number) => {
	const out: number[] = [];
	let t = start;
	let g = gap0;
	for (let i = 0; i < n; i++) {
		out.push(t);
		t += g;
		g *= 0.84;
	}
	return out;
};

/** Typewriter: characters revealed at `cps` chars per frame from `start`. */
export const typed = (f: number, text: string, start: number, cps = 1.6) =>
	f < start ? '' : text.slice(0, Math.floor((f - start) * cps) + 1);

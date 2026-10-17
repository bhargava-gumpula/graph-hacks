import type React from 'react';
import {useMemo} from 'react';
import {random, useVideoConfig} from 'remotion';
import {C, MONO} from './theme';

// One ASCII cell: Geist Mono 16px (0.6em advance) + letter-spacing = 12px wide, 20px tall.
const FS = 16;
const CW = 12;
const LH = 20;
const RAMP = '.,:;-=+*#%@';

const preStyle: React.CSSProperties = {
	position: 'absolute',
	left: 0,
	top: 0,
	margin: 0,
	fontFamily: MONO,
	fontSize: FS,
	lineHeight: `${LH}px`,
	letterSpacing: CW - FS * 0.6,
	whiteSpace: 'pre',
	pointerEvents: 'none',
};

const useGrid = () => {
	const {width, height} = useVideoConfig();
	const cols = Math.ceil(width / CW);
	const rows = Math.ceil(height / LH);
	return {width, height, cols, rows};
};

/**
 * The recurring texture: a static ASCII field, dense at the edges and empty in the middle.
 * It never idles; it only changes when something causes it (the `reveal` wave).
 */
export const AsciiField: React.FC<{
	reveal?: {x: number; y: number; r: number};
	opacity?: number;
}> = ({reveal, opacity = 0.2}) => {
	const {width, height, cols, rows} = useGrid();
	const base = useMemo(() => {
		const g: string[][] = [];
		for (let r = 0; r < rows; r++) {
			const row: string[] = [];
			for (let c = 0; c < cols; c++) {
				const x = c * CW;
				const y = r * LH;
				const dx = (x - width / 2) / (width / 2);
				const dy = (y - height / 2) / (height / 2);
				const d = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
				const vig = Math.min(1, Math.max(0, (d - 0.38) / 0.6));
				const terrain = 0.5 + 0.5 * Math.sin(x * 0.011 + Math.sin(y * 0.017) * 1.7) * Math.cos(y * 0.013 - x * 0.004);
				const v = vig * (0.45 + 0.55 * terrain);
				const on = random(`a${r}-${c}`) < v * 0.95;
				row.push(on ? RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length * (0.6 + 0.6 * random(`b${r}-${c}`))))] : ' ');
			}
			g.push(row);
		}
		return g;
	}, [cols, rows, width, height]);

	const text = base
		.map((row, r) =>
			row
				.map((ch, c) => {
					if (!reveal) return ch;
					const dx = c * CW - reveal.x;
					const dy = r * LH - reveal.y;
					return dx * dx + dy * dy <= reveal.r * reveal.r ? ch : ' ';
				})
				.join(''),
		)
		.join('\n');

	return <pre style={{...preStyle, color: C.muted, opacity}}>{text}</pre>;
};

/** A ring of ASCII characters: the shockwave / wavefront. Characters thin out toward the band edges. */
export const AsciiRing: React.FC<{
	x: number;
	y: number;
	r: number;
	band?: number;
	opacity?: number;
	color?: string;
}> = ({x, y, r, band = 60, opacity = 1, color = C.accent}) => {
	const {cols, rows} = useGrid();
	if (opacity <= 0.01 || r <= 0) return null;
	const lines: string[] = [];
	for (let row = 0; row < rows; row++) {
		let s = '';
		for (let c = 0; c < cols; c++) {
			const dx = c * CW - x;
			const dy = row * LH - y;
			const q = 1 - Math.abs(Math.sqrt(dx * dx + dy * dy) - r) / band;
			s += q > 0 && random(`r${row}-${c}`) < q * 1.3 ? RAMP[Math.min(RAMP.length - 1, Math.floor(q * RAMP.length))] : ' ';
		}
		lines.push(s);
	}
	return <pre style={{...preStyle, color, opacity}}>{lines.join('\n')}</pre>;
};

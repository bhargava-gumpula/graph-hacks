import {Interactive} from 'remotion';
import {C, MONO, SANS} from '../theme';
import {Seam, VoCue, type SceneProps} from '../ui';

/** Placeholder for the owner's live screen recording: replace this scene with the clip. */
const SlotInner: React.FC<SceneProps & {seconds?: number}> = ({guides, vo, seconds = 6}) => (
	<>
		<Seam>
			<div
				style={{
					position: 'absolute',
					inset: 56,
					border: `2px dashed ${C.faint}`,
					borderRadius: 28,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 22,
				}}
			>
				<div style={{fontFamily: MONO, fontSize: 24, letterSpacing: '0.16em', color: C.accent}}>● REC SLOT</div>
				<div style={{fontFamily: SANS, fontWeight: 600, fontSize: 76, letterSpacing: '-0.03em', color: C.text}}>Live demo goes here</div>
				<div style={{fontFamily: MONO, fontSize: 24, color: C.muted}}>
					screen recording · 1920×1080 · {seconds} s · replace the Slot scene in src/Films.tsx
				</div>
			</div>
		</Seam>
		<VoCue show={guides} text={vo} />
	</>
);

export const Slot = Interactive.create({Component: SlotInner, layout: 'absolute-fill'});

import {AbsoluteFill, Track, useCurrentFrame, useVideoConfig} from 'remotion';
import bench from '../../bench/results.json';
import {AsciiField, AsciiRing} from './Ascii';
import {Bench} from './scenes/Bench';
import {Chain} from './scenes/Chain';
import {COLD_LAND, ColdOpen} from './scenes/ColdOpen';
import {Layers} from './scenes/Layers';
import {Outro} from './scenes/Outro';
import {Slot} from './scenes/Slot';
import {With} from './scenes/With';
import {Without} from './scenes/Without';
import {Worktrees} from './scenes/Worktrees';
import {C, prog} from './theme';

export type FilmProps = {readonly guides: boolean};

// Spoken numbers come from bench/results.json.
const HOPS = ['zero', 'one', 'two', 'three', 'four'][bench.conflict.hops];
const MS = bench.checkMsMedian;

/** 1920x1080 explainer. Re-time scenes here when the voiceover lands (motion-doctrine: audio is the clock). */
export const Explainer: React.FC<FilmProps> = ({guides}) => {
	const {fps} = useVideoConfig();
	const f = useCurrentFrame();
	// The ASCII texture is revealed by the headline landing, as a wave from the words.
	const wave = prog(f, COLD_LAND, 45, (t) => 1 - Math.pow(1 - t, 3));
	return (
		<AbsoluteFill style={{backgroundColor: C.bg}}>
			<AsciiField reveal={{x: 640, y: 440, r: 2300 * wave}} opacity={0.16} />
			<AsciiRing x={640} y={440} r={2300 * wave} band={90} opacity={f >= COLD_LAND && wave < 1 ? 0.55 * (1 - wave) : 0} />
			<Track name="Scenes">
				<ColdOpen name="1 Cold open" durationInFrames={5 * fps} guides={guides} vo="Your coding agents can't see each other." />
				<Worktrees name="2 Worktrees" from={5 * fps} durationInFrames={9 * fps} guides={guides} vo="Each agent works in its own clean worktree. Both builds are green." />
				<Chain name="3 Hidden chain" from={14 * fps} durationInFrames={11 * fps} guides={guides} vo={`But the repo is a graph. LoginForm reaches session in ${HOPS} imports.`} />
				<Without name="4 Without Switchboard" from={25 * fps} durationInFrames={8 * fps} guides={guides} vo="A file lock sees two different files and says yes. Merge both, and the build breaks." />
				<With name="5 With Switchboard" from={33 * fps} durationInFrames={280} guides={guides} vo={`Switchboard checks every claim against the graph: refused by a ${MS} millisecond check, with the path as the reason.`} />
				<Slot name="Live demo slot" from={33 * fps + 280} durationInFrames={6 * fps} guides={guides} vo="[Live demo: your screen recording]" />
				<Layers name="6 Four layers" from={39 * fps + 280} durationInFrames={10 * fps} guides={guides} vo="One FalkorDB graph holds the agents, their claims, shared memory and the code." />
				<Bench name="7 Benchmark" from={49 * fps + 280} durationInFrames={8 * fps} guides={guides} vo="Ten runs, same edit, real tsc. Ten broken builds without Switchboard. Zero with it." />
				<Outro name="8 Outro" from={57 * fps + 280} durationInFrames={5 * fps} guides={guides} vo="Switchboard. Built on FalkorDB." />
			</Track>
		</AbsoluteFill>
	);
};

/** 1080x1920 vertical cut of scenes 3-5. */
export const Short: React.FC<FilmProps> = ({guides}) => {
	const {fps} = useVideoConfig();
	return (
		<AbsoluteFill style={{backgroundColor: C.bg}}>
			<AsciiField opacity={0.16} />
			<Track name="Scenes">
				<Chain name="Hidden chain" compact durationInFrames={5 * fps} guides={guides} vo={`LoginForm reaches session in ${HOPS} imports.`} />
				<Without name="Without Switchboard" compact from={5 * fps} durationInFrames={4 * fps} guides={guides} vo="A file lock says yes. The build breaks." />
				<With name="With Switchboard" compact from={9 * fps} durationInFrames={6 * fps} guides={guides} vo={`Switchboard refuses it. The check takes ${MS} ms.`} />
			</Track>
		</AbsoluteFill>
	);
};

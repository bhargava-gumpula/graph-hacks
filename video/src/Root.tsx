import {Composition, Folder} from 'remotion';
import {Explainer, Short} from './Films';
import {Bench} from './scenes/Bench';
import {Chain} from './scenes/Chain';
import {ColdOpen} from './scenes/ColdOpen';
import {Layers} from './scenes/Layers';
import {Outro} from './scenes/Outro';
import {Slot} from './scenes/Slot';
import {With} from './scenes/With';
import {Without} from './scenes/Without';
import {Worktrees} from './scenes/Worktrees';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Explainer" component={Explainer} width={1920} height={1080} fps={30} durationInFrames={2140} defaultProps={{guides: true}} />
		<Composition id="Short" component={Short} width={1080} height={1920} fps={30} durationInFrames={450} defaultProps={{guides: false}} />
		<Folder name="Scenes">
			<Composition id="ColdOpen" component={ColdOpen} width={1920} height={1080} fps={30} durationInFrames={150} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
			<Composition id="Worktrees" component={Worktrees} width={1920} height={1080} fps={30} durationInFrames={270} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
			<Composition id="Chain" component={Chain} width={1920} height={1080} fps={30} durationInFrames={330} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
			<Composition id="Without" component={Without} width={1920} height={1080} fps={30} durationInFrames={240} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
			<Composition id="With" component={With} width={1920} height={1080} fps={30} durationInFrames={280} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
			<Composition id="Slot" component={Slot} width={1920} height={1080} fps={30} durationInFrames={180} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
			<Composition id="Layers" component={Layers} width={1920} height={1080} fps={30} durationInFrames={300} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
			<Composition id="Bench" component={Bench} width={1920} height={1080} fps={30} durationInFrames={240} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
			<Composition id="Outro" component={Outro} width={1920} height={1080} fps={30} durationInFrames={150} defaultProps={{style: {backgroundColor: '#0b0b0d'}}} />
		</Folder>
	</>
);

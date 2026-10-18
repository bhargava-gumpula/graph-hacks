// Generates the Demo voiceover with macOS `say` and writes src/vo.json (text + seconds per scene).
// Usage: node scripts/make-vo.mjs   (needs `say`, ffmpeg and ffprobe)
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const LINES = {
	cold: "Your coding agents can't see each other.",
	worktrees: 'Each agent gets its own worktree. Agent A makes the session label an object. Agent B shows that label on login. Both type check alone.',
	chain: 'But the repo is a graph. The login form imports login, and login imports the session module. Two imports apart, and neither agent can see that link.',
	without: 'A file lock sees two different files and says yes. Merge both, and the build breaks with a real type error.',
	with: "Switchboard keeps one FalkorDB graph of the repo's imports and of who is editing what. Before each edit, a hook asks the graph whether an import path links that file to another agent's claim. If one does, the edit is refused with the exact path, and the agent is told when the file is free.",
	demo: "Here is the live site. The agents are scripted, but the graph and the check are real. Agent A is changing the session module. Agent B wants the login form, a different file in a different folder. Switchboard follows the imports, two hops, and refuses the edit before any code is written. The same graph remembers decisions and lessons. Tasks are put in rounds by the imports between their files, and tasks in one round run at the same time.",
	bench: 'The proof. Ten runs, same two edits, real TypeScript compiler. Without Switchboard, ten of ten merged builds broke. With it, zero, and the median check takes 0.7 milliseconds. CI would catch this too, after the merge. Switchboard stops it before a line is written.',
	install: 'To install in Claude Code, add the marketplace and install the plugin. Or clone the repo and run npm run quickstart.',
	outro: 'Try the live demo at switchboard-agents.xyz. Switchboard, built on FalkorDB.',
};

mkdirSync('public/vo', {recursive: true});
const out = {};
for (const [k, text] of Object.entries(LINES)) {
	const aiff = join(tmpdir(), `sb-vo-${k}.aiff`);
	execFileSync('say', ['-v', 'Samantha', '-r', '175', '-o', aiff, text.replace('0.7', 'zero point seven').replace('switchboard-agents.xyz', 'switchboard agents dot X Y Z')]);
	execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '48000', '-ac', '1', `public/vo/${k}.wav`]);
	const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', aiff]).toString());
	out[k] = {text, seconds};
	console.log(k, seconds.toFixed(2));
}
writeFileSync('src/vo.json', JSON.stringify(out, null, '\t') + '\n');

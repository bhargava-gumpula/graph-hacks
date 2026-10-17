/** How the UI names agents. Ids follow the agent-id contract: `<editor>@<branch>` by default, SB_AGENT overrides. */
const EDITORS: Record<string, string> = { claude: "Claude Code", cursor: "Cursor" };
const EDITOR_ID = /^(claude|cursor)@(.+)$/;

/** claude@main → "Claude Code · main", cursor@main → "Cursor · main", the demo's A to D → "Agent A", others as they are. */
export function agentName(id: string): string {
  const m = EDITOR_ID.exec(id);
  if (m) return `${EDITORS[m[1]]} · ${m[2]}`;
  return /^[A-Z]$/.test(id) ? `Agent ${id}` : id;
}

/** Two characters for an avatar or a claim badge. */
export function agentBadge(id: string): string {
  const m = EDITOR_ID.exec(id);
  return m ? (m[1] === "claude" ? "CC" : "Cu") : id.slice(0, 2);
}

/** True when the id already says which editor it is, so a card needs no tool line. */
export const namesEditor = (id: string) => EDITOR_ID.test(id);

/** The demo story's two agents. A script drives them (packages/core/src/demo.ts), not an editor. */
export const isScripted = (id: string | null | undefined) => id === "A" || id === "B";

/** "Cursor · main and Agent B": names joined for a sentence. */
export const agentList = (ids: string[]) => {
  const names = ids.map(agentName);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
};

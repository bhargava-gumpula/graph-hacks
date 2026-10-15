import { badgeLabel, preview, titleCase } from "../lib/format";

export function renderEmpty(name: string, hint: string): string {
  const title = titleCase("no notes yet");
  return badgeLabel(name) + " " + title + " " + preview(hint, 40);
}

export function emptyLabel(): string {
  return "Empty";
}

export const EMPTY_HINT = "Write the first note";

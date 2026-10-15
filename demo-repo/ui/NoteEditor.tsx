import { createNote, noteSummary } from "../api/notes";

export function renderEditor(authorId: string, title: string, body: string): string {
  const note = createNote(authorId, title, body);
  if (note === null) {
    return "untitled";
  }
  return "edit " + noteSummary(note);
}

export function editorLabel(): string {
  return "Editor";
}

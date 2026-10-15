import { createNote, noteSummary } from "../api/notes";
import { slug } from "../lib/utils";

export function renderNotes(authorId: string, title: string, body: string): string {
  const note = createNote(authorId, title, body);
  if (note === null) {
    return slug("missing");
  }
  return noteSummary(note);
}

export function notesHeading(): string {
  return "Notes";
}

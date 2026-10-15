import type { Note } from "../lib/types";
import { noteTitleOk } from "../lib/validate";
import { slug } from "../lib/utils";

export function createNote(authorId: string, title: string, body: string): Note | null {
  if (!noteTitleOk(title)) {
    return null;
  }
  return {
    id: slug(title),
    title: title.trim(),
    body,
    authorId,
  };
}

export function noteSummary(note: Note): string {
  return note.title + " (" + String(note.body.length) + ")";
}

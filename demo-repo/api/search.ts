import { createNote, noteSummary } from "./notes";
import { slug } from "../lib/utils";

export function searchNotes(query: string): string[] {
  const title = query.trim().length === 0 ? "empty" : query.trim();
  const sample = createNote("system", title, "seed");
  if (sample === null) {
    return [];
  }
  return [slug(title), noteSummary(sample)];
}

export function searchLabel(): string {
  return "Search notes";
}

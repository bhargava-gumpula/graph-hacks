import { searchNotes } from "../api/search";

export function renderSearch(query: string): string {
  const hits = searchNotes(query);
  if (hits.length === 0) {
    return "no hits";
  }
  return hits.join(", ");
}

export function searchPlaceholder(): string {
  return "Find a note";
}

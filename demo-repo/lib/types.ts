/** Shared shapes for people, notes, and preferences. */

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  authorId: string;
}

export interface Preferences {
  theme: "light" | "dark";
  pageSize: number;
}

export const NOTE_BODY_LIMIT = 2000;

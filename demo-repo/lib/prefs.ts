import { clamp } from "./utils";

export const DEFAULT_THEME = "light";
export const MIN_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 50;

export interface StoredPrefs {
  theme: string;
  pageSize: number;
}

export function normalizePrefs(theme: string, pageSize: number): StoredPrefs {
  const safeTheme = theme === "dark" ? "dark" : DEFAULT_THEME;
  return {
    theme: safeTheme,
    pageSize: clamp(pageSize, MIN_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export function prefsLabel(prefs: StoredPrefs): string {
  return prefs.theme + ":" + String(prefs.pageSize);
}

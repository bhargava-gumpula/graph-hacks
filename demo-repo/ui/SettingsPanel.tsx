import type { Preferences } from "../lib/prefs";
import { readSettings } from "../api/settings";
import { slug } from "../lib/utils";

export function renderSettings(prefs: Preferences): string {
  const view = readSettings(prefs.theme, prefs.pageSize);
  return slug(view.key) + " " + view.label;
}

export function settingsFields(prefs: Preferences): { theme: string; pageSize: number } {
  return { theme: prefs.theme, pageSize: prefs.pageSize };
}

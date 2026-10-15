import { normalizePrefs, prefsLabel } from "../lib/prefs";
import { slug } from "../lib/utils";

export interface SettingsView {
  key: string;
  theme: string;
  pageSize: number;
  label: string;
}

export function readSettings(theme: string, pageSize: number): SettingsView {
  const prefs = normalizePrefs(theme, pageSize);
  return {
    key: slug(prefs.theme),
    theme: prefs.theme,
    pageSize: prefs.pageSize,
    label: prefsLabel(prefs),
  };
}

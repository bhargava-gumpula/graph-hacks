/** Shared helpers. Many modules import this file; it imports nothing. */

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slug(text: string): string {
  const lowered = text.trim().toLowerCase();
  const dashed = lowered.replace(/[^a-z0-9]+/g, "-");
  return dashed.replace(/^-+|-+$/g, "");
}

export function initials(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  return parts.map((part) => (part[0] ?? "").toUpperCase()).join("");
}

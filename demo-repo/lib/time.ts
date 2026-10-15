export const MINUTE_MS = 60_000;
export const SESSION_TTL_MS = 30 * MINUTE_MS;

export function addMinutes(iso: string, minutes: number): string {
  const start = Date.parse(iso);
  const base = Number.isNaN(start) ? 0 : start;
  return new Date(base + minutes * MINUTE_MS).toISOString();
}

export function isPast(iso: string, now: string): boolean {
  const left = Date.parse(iso);
  const right = Date.parse(now);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return false;
  }
  return left <= right;
}

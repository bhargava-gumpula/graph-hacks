import { MINUTE_MS, addMinutes } from "../lib/time";

export function renderFooter(at: string): string {
  const until = addMinutes(at, 1);
  return "updated " + until;
}

export function footerTick(): number {
  return MINUTE_MS;
}

export function footerLabel(): string {
  return "Footer";
}

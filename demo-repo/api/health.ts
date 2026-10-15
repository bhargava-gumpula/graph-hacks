import { SESSION_TTL_MS, isPast } from "../lib/time";
import { nowIso } from "../lib/utils";

export interface Health {
  ok: boolean;
  at: string;
  ttlMs: number;
}

export function health(epoch: string): Health {
  const at = nowIso();
  return {
    ok: !isPast(at, epoch),
    at,
    ttlMs: SESSION_TTL_MS,
  };
}

export function healthLine(report: Health): string {
  return report.at + " ttl=" + String(report.ttlMs);
}

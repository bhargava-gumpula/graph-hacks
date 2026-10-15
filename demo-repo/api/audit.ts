import { AppError, formatError } from "../lib/errors";
import { addMinutes } from "../lib/time";

export function auditLine(action: string, at: string): string {
  const until = addMinutes(at, 5);
  return action + " until " + until;
}

export function auditFailure(message: string): string {
  return formatError(new AppError("audit", message));
}

export function auditOk(action: string): string {
  return action + " recorded";
}

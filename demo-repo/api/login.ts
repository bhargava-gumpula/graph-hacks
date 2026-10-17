import { openSession, sessionLabel } from "../auth/session";
import { nowIso } from "../lib/utils";

export interface LoginResult {
  ok: boolean;
  label: ReturnType<typeof sessionLabel>;
  at: string;
}

export function login(userId: string, password: string): LoginResult {
  const session = openSession(userId, password);
  return {
    ok: session.passwordHash.length > 0,
    label: sessionLabel(session),
    at: nowIso(),
  };
}

export function loginHeadline(result: LoginResult): string {
  return result.at + " " + result.label;
}

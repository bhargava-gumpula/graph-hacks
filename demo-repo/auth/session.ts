import { hashPassword } from "@lib/crypto";
import { nowIso } from "../lib/utils";

export interface OpenSession {
  token: string;
  userId: string;
  passwordHash: string;
  openedAt: string;
}

export function openSession(userId: string, password: string): OpenSession {
  return {
    token: "tok_" + userId,
    userId,
    passwordHash: hashPassword(password),
    openedAt: nowIso(),
  };
}

export function sessionLabel(session: OpenSession): string {
  return session.userId + "@" + session.openedAt;
}

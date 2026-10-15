import { isEmail, isNonEmpty } from "../lib/validate";
import { slug } from "../lib/utils";

export interface PasswordCheck {
  ok: boolean;
  reason: string;
}

export function checkPassword(password: string): PasswordCheck {
  if (!isNonEmpty(password) || password.length < 8) {
    return { ok: false, reason: "too-short" };
  }
  return { ok: true, reason: "ok" };
}

export function loginName(email: string): string {
  if (!isEmail(email)) {
    return "guest";
  }
  const local = email.split("@")[0] ?? "guest";
  const name = slug(local);
  return name.length === 0 ? "guest" : name;
}

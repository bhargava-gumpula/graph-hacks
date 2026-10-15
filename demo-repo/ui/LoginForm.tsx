import type { User } from "../lib/types";
import { login, loginHeadline } from "../api/login";
import { initials } from "../lib/utils";

export function renderLogin(user: User, password: string): string {
  const result = login(user.id, password);
  const mark = initials(user.name);
  const who = mark.length === 0 ? user.email : mark;
  return who + " " + loginHeadline(result);
}

export function loginFields(user: User): { email: string; name: string } {
  return { email: user.email, name: user.name };
}

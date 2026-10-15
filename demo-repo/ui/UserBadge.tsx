import { createUser, userLine } from "../api/users";
import { initials } from "../lib/utils";

export function renderBadge(name: string): string {
  const user = createUser(name);
  const mark = initials(name);
  const prefix = mark.length === 0 ? user.mark : mark;
  return prefix + " " + userLine(user);
}

export function badgeHeading(): string {
  return "People";
}

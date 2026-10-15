import { buildProfile } from "../api/profile";
import { createUser } from "../api/users";

export function renderMenu(name: string, roleName: string): string {
  const profile = buildProfile(name, roleName);
  const user = createUser(name);
  return profile.line + " / " + user.id + " / " + profile.access;
}

export function menuLabel(): string {
  return "Account";
}

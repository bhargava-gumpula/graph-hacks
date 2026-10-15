import { canManageUsers, isRole } from "./roles";
import { slug } from "../lib/utils";

export function allowAdmin(roleName: string): boolean {
  if (!isRole(roleName)) {
    return false;
  }
  return canManageUsers(roleName);
}

export function guardName(action: string): string {
  const dashed = slug(action);
  const name = dashed.length === 0 ? "action" : dashed;
  return "guard-" + name;
}

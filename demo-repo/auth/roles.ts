/** Role names used by guards and the profile screen. */

export const ROLES = ["member", "admin"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return value === "member" || value === "admin";
}

export function canEditNotes(role: Role): boolean {
  return role === "member" || role === "admin";
}

export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

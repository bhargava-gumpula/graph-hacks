import { canEditNotes, canManageUsers, isRole } from "./roles";

export interface Gate {
  editNotes: boolean;
  manageUsers: boolean;
}

export function gateFor(roleName: string): Gate {
  if (!isRole(roleName)) {
    return { editNotes: false, manageUsers: false };
  }
  return {
    editNotes: canEditNotes(roleName),
    manageUsers: canManageUsers(roleName),
  };
}

export function gateLabel(gate: Gate): string {
  return "notes=" + String(gate.editNotes) + " users=" + String(gate.manageUsers);
}

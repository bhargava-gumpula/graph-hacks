import { gateFor, gateLabel } from "../auth/policy";
import { createUser, userLine } from "./users";

export interface Profile {
  id: string;
  name: string;
  line: string;
  access: string;
}

export function buildProfile(name: string, roleName: string): Profile {
  const user = createUser(name);
  const gate = gateFor(roleName);
  return {
    id: user.id,
    name: user.name,
    line: userLine(user),
    access: gateLabel(gate),
  };
}

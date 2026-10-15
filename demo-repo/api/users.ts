import { nextId } from "@lib/ids";
import { initials } from "../lib/utils";

export interface UserRecord {
  id: string;
  name: string;
  mark: string;
}

export function createUser(name: string): UserRecord {
  const mark = initials(name);
  return {
    id: nextId("user"),
    name,
    mark: mark.length === 0 ? "?" : mark,
  };
}

export function userLine(user: UserRecord): string {
  return user.mark + " " + user.name;
}

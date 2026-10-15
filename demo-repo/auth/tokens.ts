import { nextId } from "../lib/ids";
import { nowIso } from "../lib/utils";

export interface Token {
  id: string;
  issuedAt: string;
}

export function issueToken(): Token {
  return {
    id: nextId("token"),
    issuedAt: nowIso(),
  };
}

export function tokenHeader(token: Token): string {
  return "Bearer " + token.id;
}

import { formatError } from "@lib/errors";
import { initials } from "../lib/utils";

export function renderHeader(name: string, problem: unknown): string {
  const mark = initials(name);
  const who = mark.length === 0 ? "team" : mark;
  return who + " | " + formatError(problem);
}

export function headerTitle(): string {
  return "Team notes";
}

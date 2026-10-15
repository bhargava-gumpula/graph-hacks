import { slug } from "./utils";

let counter = 0;

export function nextId(prefix: string): string {
  counter += 1;
  const base = slug(prefix);
  const name = base.length === 0 ? "id" : base;
  return name + "-" + String(counter);
}

export function resetIds(): void {
  counter = 0;
}

export function peekCount(): number {
  return counter;
}

import { clamp, initials } from "@lib/utils";

export function titleCase(value: string): string {
  return value
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => {
      const head = word[0] ?? "";
      return head.toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function preview(text: string, max: number): string {
  const limit = clamp(max, 8, 240);
  if (text.length <= limit) {
    return text;
  }
  return text.slice(0, limit - 1) + "...";
}

export function badgeLabel(name: string): string {
  const mark = initials(name);
  return mark.length === 0 ? "?" : mark;
}

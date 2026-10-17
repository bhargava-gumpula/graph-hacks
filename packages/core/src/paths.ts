import { join } from "node:path";

/** This checkout's root (packages/core/src → ../../..). SB_ROOT overrides it. */
const CHECKOUT = join(import.meta.dirname, "../../..");

/**
 * The repo-relative path the parser stores (`ui/LoginForm.tsx`), whatever form an
 * agent sent: strips an absolute repo root, a leading `./`, and the parsed repo's
 * directory `${SB_PREFIX ?? 'demo-repo'}/` (an empty SB_PREFIX strips nothing).
 * Without this, `demo-repo/ui/LoginForm.tsx` matched no File and passed as safe.
 */
export function normPath(p: string): string {
  const root = (process.env.SB_ROOT ?? CHECKOUT).replace(/\/+$/, "");
  let out = p.trim();
  if (out.startsWith(`${root}/`)) out = out.slice(root.length + 1);
  while (out.startsWith("./")) out = out.slice(2);
  const prefix = (process.env.SB_PREFIX ?? "demo-repo").replace(/\/+$/, "");
  if (prefix && out.startsWith(`${prefix}/`)) out = out.slice(prefix.length + 1);
  return out;
}

import { describe, expect, it } from "vitest";
import { importPath } from "./layoutGraph";
import type { Snapshot } from "./api";

const imp = (source: string, target: string) => ({ source, target, kind: "IMPORTS" as const });
const g: Snapshot = {
  nodes: [],
  edges: [imp("ui/LoginForm.tsx", "api/login.ts"), imp("api/login.ts", "auth/session.ts"), imp("ui/LoginForm.tsx", "lib/x.ts"), imp("lib/x.ts", "lib/y.ts"), imp("lib/y.ts", "auth/session.ts")],
};

describe("importPath", () => {
  it("finds the shortest import chain, in import direction", () => {
    expect(importPath(g, "ui/LoginForm.tsx", "auth/session.ts")).toEqual(["ui/LoginForm.tsx", "api/login.ts", "auth/session.ts"]);
    expect(importPath(g, "auth/session.ts", "ui/LoginForm.tsx")).toEqual([]);
    expect(importPath(g, "lib/x.ts", "lib/x.ts")).toEqual(["lib/x.ts"]);
  });
});

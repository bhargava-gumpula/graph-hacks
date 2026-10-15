import { expect, test } from "vitest";
import { SWITCHBOARD_VERSION } from "./index.js";

test("SWITCHBOARD_VERSION is a string", () => {
  expect(typeof SWITCHBOARD_VERSION).toBe("string");
});

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "demo-repo/**", "docs/**", "apps/web/**", ".claude/**", "video/**", "bench/runs/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
);

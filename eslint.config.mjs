import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Harness-managed git worktrees are full repo copies — not source to lint
    // (they double every finding and lint a stale committed snapshot).
    ".claude/**",
    // The pitch deck is a self-contained artifact directory — a static HTML
    // deck plus Node/Python build scripts (build-pptx.js is CommonJS, run via
    // `node`, so its require() calls are correct there and must not become ESM).
    // Not application source.
    "deck/**",
  ]),
]);

export default eslintConfig;

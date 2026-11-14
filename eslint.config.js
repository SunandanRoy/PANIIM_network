import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "dist-web", "node_modules", "out", "coverage", "playwright-report", "test-results", "integration/tanstack-start", "harness/proof"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["react-router*", "@tanstack/react-router", "@tanstack/react-start"], message: "Module is router-agnostic: use the adapter." },
          { group: ["@/integrations/*", "@supabase/*"], message: "Never import host Supabase files; use adapter.supabase." }
        ]
      }]
    }
  },
  {
    files: ["harness/**/*.{ts,tsx}", "integration/**/*.{ts,tsx}", "e2e/**/*.ts"],
    rules: { "no-restricted-imports": "off" }
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node } }
  }
);

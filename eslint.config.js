import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/", "coverage/", "android/", "ios/", ".expo/", "src/data/bundled/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["test/**", "scripts/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    // Jest mock factories load their fakes with require, as jest.mock demands.
    files: ["test/ui/**"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Expo loads config plugins with require, so they stay CommonJS.
    files: ["plugins/**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  prettier,
);

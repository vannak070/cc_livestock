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
    // The public website is its own app with its own lint setup.
    "website/**",
  ]),
  {
    rules: {
      // No component copies props or stored values into state inside an effect any
      // more (stored values use useStoredValue, resets use useOnChange), so keep it out.
      "react-hooks/set-state-in-effect": "error",
      // `const { password, ...safe } = user` is how secrets are stripped before data
      // leaves a repository or service; the dropped names are intentionally unused.
      // Express needs all four arguments on an error handler, so `_next` is allowed.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;

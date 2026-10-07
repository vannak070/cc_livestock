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
      // 13 existing components copy props/localStorage/defaults into state inside
      // an effect (edit modals, language preference, a few tab defaults). Fixing
      // them means re-keying components or deriving state, which changes UI
      // behaviour, so they are tracked as warnings until each is reworked and
      // verified in the browser. New code should not add to the list.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;

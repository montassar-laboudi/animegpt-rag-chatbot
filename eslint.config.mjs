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
  ]),
  {
    // setState in useEffect is the correct SSR-safe pattern for reading localStorage on mount.
    // The rule is overly restrictive for Next.js initialization flows.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // These files use <img> with data: URLs (base64 previews) which next/image does not support.
    files: ["app/components/Bubble.tsx", "app/page.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;

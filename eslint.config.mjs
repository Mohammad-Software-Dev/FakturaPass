import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "node_modules/**",
      "services/invoice-engine/vendor/**",
      "next-env.d.ts",
      "apps/web/next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);

import js from "@eslint/js";
import eslintParser from "@babel/eslint-parser";

export default [
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: eslintParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          configFile: false,
          babelrc: false,
          presets: ["@babel/preset-typescript"],
          parserOpts: {
            plugins: ["typescript"],
          },
        },
      },
      // TypeScript owns type resolution; babel parser does not define globals
      // like `console`/`process` types for eslint, so keep no-undef quiet.
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": ["warn", { args: "none" }],
    },
  },
];

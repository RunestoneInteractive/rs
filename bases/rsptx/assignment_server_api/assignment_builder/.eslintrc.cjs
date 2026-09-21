module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  ignorePatterns: [".eslintrc.cjs"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: ["react", "import", "@typescript-eslint", "prettier", "react-hooks", "only-warn"],
  extends: [
    "airbnb-typescript",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  settings: {
    react: {
      version: "detect"
    }
  },
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    semi: "warn",
    "import/prefer-default-export": "off",
    "no-undef": "off",
    "newline-after-var": ["error", "always"],
    "max-len": [
      "error",
      {
        ignorePattern: "^.+ from .+$",
        code: 140,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true
      }
    ],
    "import/named": "off",
    "import/no-extraneous-dependencies": "off",
    "import/no-unresolved": "off",
    "import/extensions": "off",
    "no-restricted-imports": "off",
    "import/order": [
      "warn",
      {
        groups: [["builtin", "external", "internal"], "parent", ["sibling", "index"]],
        pathGroups: [
          {
            pattern: "react*",
            group: "builtin",
            position: "before"
          },
          {
            pattern: "@*(reduxjs|dnd-kit|snowplow)/**/*",
            group: "external",
            position: "after"
          }
        ],
        alphabetize: {
          order: "asc",
          caseInsensitive: false
        },
        "newlines-between": "always"
      }
    ],
    "react/prop-types": "off",
    "react/destructuring-assignment": "off",
    "react/no-array-index-key": "off",
    "react/no-unused-prop-types": "off",
    "react/require-default-props": "off",
    "jsx-quotes": ["error", "prefer-double"],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",
    "react/react-in-jsx-scope": "off",
    "react/jsx-curly-brace-presence": "error",
    "jsx-a11y/click-events-have-key-events": "off",
    "jsx-a11y/no-static-element-interactions": "off",
    "jsx-a11y/control-has-associated-label": "off",
    "jsx-a11y/label-has-associated-control": "off",
    "jsx-a11y/alt-text": "off",
    "import/no-cycle": "off",
    "react/jsx-one-expression-per-line": "off",
    "@typescript-eslint/semi": "off",
    "@typescript-eslint/no-redeclare": "off",
    "no-underscore-dangle": [
      "error",
      {
        allowAfterThis: true
      }
    ],
    "no-console": "off",
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": [
      "error",
      {
        functions: false,
        variables: false
      }
    ],
    "@typescript-eslint/naming-convention": "off",
    quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
    "prettier/prettier": ["error", { singleQuote: false, trailingComma: "none" }]
  },
  overrides: [
    {
      files: ["**/*.spec.ts", "**/*.spec.tsx"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off"
      }
    }
  ]
};

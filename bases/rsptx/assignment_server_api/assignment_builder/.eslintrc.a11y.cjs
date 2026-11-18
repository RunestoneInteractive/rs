const jsxA11y = require("eslint-plugin-jsx-a11y");

const warningRules = Object.fromEntries(
  Object.entries(jsxA11y.configs.recommended.rules).map(([ruleName, configuration]) => [
    ruleName,
    Array.isArray(configuration) ? ["warn", ...configuration.slice(1)] : "warn"
  ])
);

module.exports = {
  extends: ["./.eslintrc.cjs", "plugin:jsx-a11y/recommended"],
  rules: {
    ...warningRules,
    // Deprecated duplicate of label-has-associated-control.
    "jsx-a11y/label-has-for": "off"
  }
};

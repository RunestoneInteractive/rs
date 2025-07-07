// Common math macros for both MathJax and KaTeX
// These macros define shortcuts for mathematical symbols and expressions

// Base macro definitions - define macros here ONCE
// Format: key (without backslash) -> LaTeX command
const baseMacroDefinitions = {
  // Number sets (blackboard bold)
  R: "\\mathbb{R}", // Real numbers
  N: "\\mathbb{N}", // Natural numbers
  Z: "\\mathbb{Z}", // Integers
  Q: "\\mathbb{Q}", // Rational numbers
  C: "\\mathbb{C}", // Complex numbers

  // Common fractions (shorthand for frequently used fractions)
  half: "\\frac{1}{2}",
  third: "\\frac{1}{3}",
  quarter: "\\frac{1}{4}",

  // Mathematical operators and functions
  E: "\\mathbb{E}", // Expected value / Expectation
  P: "\\mathbb{P}", // Probability
  Var: "\\text{Var}", // Variance
  Cov: "\\text{Cov}", // Covariance

  // Limits (commonly used in calculus)
  limi: "\\lim_{i \\to \\infty}", // Limit as i approaches infinity
  limn: "\\lim_{n \\to \\infty}", // Limit as n approaches infinity
  limx: "\\lim_{x \\to 0}", // Limit as x approaches 0

  // Derivatives (partial derivatives)
  pd: "\\partial" // Partial derivative symbol

  // Additional useful shortcuts can be added here
};

// MathJax macros (used in MathJaxWrapper)
// MathJax expects macro names without backslashes: use $R$ in text
export const mathJaxMacros = baseMacroDefinitions;

// KaTeX macros (used in TipTap Editor)
// KaTeX expects macro names WITH backslashes: use $\R$ in text
// This function automatically converts base macros to KaTeX format
export const katexMacros = Object.keys(baseMacroDefinitions).reduce(
  (acc, key) => {
    acc[`\\${key}`] = baseMacroDefinitions[key as keyof typeof baseMacroDefinitions];
    return acc;
  },
  {} as { [key: string]: string }
);

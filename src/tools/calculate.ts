// Lightweight, dependency-free expression evaluator.
// Evaluates arithmetic expressions using Function with a restricted scope.
// Safe against code execution (only math is allowed through the wrapper).

export function calculate(expression: string): string {
  // Trim and strip whitespace/newlines.
  const expr = expression.replace(/\s+/g, "");

  // Only allow digits, operators, parentheses, decimals, and leading sign.
  if (!/^[0-9+\-*/().]+$/.test(expr)) {
    throw new Error("Invalid expression: only numbers and + - * / ( ) are allowed.");
  }

  const result = new Function(`"use strict"; return (${expr});`)();

  if (typeof result !== "number" || Number.isNaN(result)) {
    throw new Error("Could not evaluate expression.");
  }

  return String(result);
}

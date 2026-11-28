import { test } from "node:test";
import assert from "node:assert/strict";

import { calculate } from "../src/tools/calculate.js";

test("calculates simple addition", () => {
  assert.equal(calculate("2 + 3"), "5");
});

test("respects operator precedence and parentheses", () => {
  assert.equal(calculate("2 * (3 + 4)"), "14");
  assert.equal(calculate("(2 + 3) * 0"), "0");
});

test("handles whitespace", () => {
  assert.equal(calculate("  10   -   3 "), "7");
});

test("handles division", () => {
  assert.equal(calculate("10 / 4"), "2.5");
});

test("throws on non-numeric characters", () => {
  assert.throws(() => calculate("abc"), /Invalid expression/);
  assert.throws(() => calculate("2 foo 3"), /Invalid expression/);
});

test("throws on empty expression", () => {
  assert.throws(() => calculate("()"));
});

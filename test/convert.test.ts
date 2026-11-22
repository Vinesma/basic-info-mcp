import { test } from "node:test";
import assert from "node:assert/strict";

import { convertUnits } from "../src/tools/convert.js";

test("converts length km to mi", () => {
    assert.equal(convertUnits(1, "km", "mi", "length"), "0.621371192237 mi");
});

test("converts volume cm3 to ml (the cm3 fix)", () => {
    assert.equal(convertUnits(1, "cm3", "ml", "volume"), "1 ml");
});

test("converts volume cm3 to litres", () => {
    assert.equal(convertUnits(1000, "cm3", "l", "volume"), "1 l");
});

test("converts mass kg to lb", () => {
    assert.equal(
        convertUnits(1, "kg", "lb", "mass"),
        "2.20462262185 lb",
    );
});

test("throws on unknown unit", () => {
    assert.throws(() => convertUnits(1, "xyz", "mi", "length"));
});

test("throws on unknown dimension", () => {
    assert.throws(() => convertUnits(1, "m", "km", "area" as any));
});

import { test } from "node:test";
import assert from "node:assert/strict";

import { getDateTime } from "../src/tools/datetime.js";

test("returns a parseable date string", () => {
    const value = getDateTime();
    assert.equal(typeof value, "string");
    assert.notEqual(value, "");
    assert.equal(Number.isNaN(Date.parse(value)), false);
});

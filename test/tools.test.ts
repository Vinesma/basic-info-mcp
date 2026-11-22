import { test } from "node:test";
import assert from "node:assert/strict";

import { tools, buildServer } from "../src/tools/index.js";

test("registers the expected tools", () => {
    const names = tools.map((tool) => tool.name);
    assert.deepEqual(names, [
        "get-date-time",
        "calculate",
        "convert-units",
    ]);
});

test("every tool has a description and a handler", () => {
    for (const tool of tools) {
        assert.equal(typeof tool.description, "string");
        assert.notEqual(tool.description.length, 0);
        assert.equal(typeof tool.handler, "function");
    }
});

test("buildServer returns an McpServer", () => {
    const server = buildServer();
    assert.equal(typeof server, "object");
    assert.equal(typeof server.registerTool, "function");
});

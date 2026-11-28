import { test } from "node:test";
import assert from "node:assert/strict";

import { tools, buildServer } from "../src/tools/index.js";

test("registers the expected tools", () => {
    const names = tools.map((tool) => tool.name);
    assert.deepEqual(names, [
        "get-date-time",
        "calculate",
        "convert-units",
        "web-search",
        "fetch-json",
        "fetch-page",
        "download-file",
        "rss-feed",
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

test("web-search exposes logFields that logs the query", () => {
    const tool = tools.find((t) => t.name === "web-search");
    assert.ok(tool, "web-search should be registered");
    assert.equal(typeof tool.logFields, "function");
    assert.deepEqual(tool.logFields?.({ query: "hello" }), {
        query: "hello",
    });
});

test("url tools omit logFields (log via url only)", () => {
    for (const name of ["fetch-json", "fetch-page", "download-file", "rss-feed"]) {
        const tool = tools.find((t) => t.name === name);
        assert.ok(tool, `${name} should be registered`);
        assert.equal(tool.logFields, undefined);
    }
});

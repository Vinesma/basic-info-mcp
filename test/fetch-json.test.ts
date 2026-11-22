import { test } from "node:test";
import assert from "node:assert/strict";

import { fetchJson } from "../src/tools/fetch-json.js";
import { tools } from "../src/tools/index.js";

function jsonBody(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(body),
    } as Response;
}

test("returns the JSON body as a string", async () => {
    globalThis.fetch = async () =>
        jsonBody({ hello: "world", n: 42 }) as Response;
    try {
        const out = await fetchJson("https://api.example.com/data");
        assert.deepEqual(JSON.parse(out), { hello: "world", n: 42 });
    } finally {
        globalThis.fetch = async () => jsonBody({});
    }
});

test("uses the provided method", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        assert.equal(init?.method, "POST");
        return jsonBody({ ok: true }) as Response;
    }) as typeof fetch;
    try {
        await fetchJson("https://api.example.com/create", { method: "POST" });
    } finally {
        globalThis.fetch = original;
    }
});

test("throws on non-2xx response", async () => {
    globalThis.fetch = async () =>
        ({
            ok: false,
            status: 404,
            statusText: "Not Found",
            text: async () => "",
        }) as Response;
    try {
        await assert.rejects(() => fetchJson("https://api.example.com/missing"), /HTTP 404/);
    } finally {
        globalThis.fetch = async () => jsonBody({});
    }
});

test("throws when body exceeds max_bytes", async () => {
    globalThis.fetch = async () =>
        ({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => JSON.stringify({ data: "x".repeat(5000) }),
        }) as Response;
    try {
        await assert.rejects(
            () => fetchJson("https://api.example.com/big", { max_bytes: 100 }),
            /exceeds 100 bytes/,
        );
    } finally {
        globalThis.fetch = async () => jsonBody({});
    }
});

test("throws on invalid JSON", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
        ({ ok: true, status: 200, statusText: "OK", text: async () => "not json" }) as Response;
    try {
        await assert.rejects(() => fetchJson("https://api.example.com/bad"), /invalid JSON/);
    } finally {
        globalThis.fetch = original;
    }
});

test("is registered in the tool list", async () => {
    const tool = tools.find((t) => t.name === "fetch-json");
    assert.ok(tool, "fetch-json should be registered");
    assert.equal(tool?.title, "Fetch JSON");
    assert.ok(tool?.inputSchema);
});

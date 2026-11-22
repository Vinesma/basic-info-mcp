import { test } from "node:test";
import assert from "node:assert/strict";

import { webSearch } from "../src/tools/web-search.js";
import { tools } from "../src/tools/index.js";

const SAMPLE = {
    query: "test",
    results: [
        {
            url: "https://en.wikipedia.org/wiki/Test",
            title: "Test - Wikipedia",
            content: "Look up test in Wiktionary.",
            engine: "wikipedia",
        },
        {
            url: "https://example.org/answer",
            title: "The Answer",
            content: "42.",
        },
    ],
};

test("formats results as numbered list", async () => {
    const fetched = globalThis.fetch;
    globalThis.fetch = async () =>
        ({ text: async () => JSON.stringify(SAMPLE) }) as Response;
    try {
        const out = await webSearch("https://searx.example/", {
            query: "test",
            max_results: 10,
        });
        assert.match(out, /^1\. Test - Wikipedia/s);
        assert.match(out, /URL: https:\/\/en\.wikipedia\.org\/wiki\/Test/);
        assert.match(out, /2\. The Answer/);
        assert.equal(out.split("\n").filter((l) => /^\d\./.test(l)).length, 2);
    } finally {
        globalThis.fetch = fetched;
    }
});

test("caps results at max_results", async () => {
    const big = {
        query: "x",
        results: Array.from({ length: 25 }, (_, i) => ({
            url: `https://example.com/${i}`,
            title: `Result ${i}`,
            content: `content ${i}`,
        })),
    };
    const fetched = await globalThis.fetch;
    globalThis.fetch = async () =>
        ({ text: async () => JSON.stringify(big) }) as Response;
    try {
        const out = await webSearch("https://searx.example/", {
            query: "x",
            max_results: 3,
        });
        assert.equal(out.split("\n").filter((l) => /^\d\./.test(l)).length, 3);
    } finally {
        globalThis.fetch = fetched;
    }
});

test("returns message when no results", async () => {
    const fetched = globalThis.fetch;
    globalThis.fetch = async () =>
        ({ text: async () => JSON.stringify({ query: "x", results: [] }) }) as
            | Response
            | Promise<Response>;
    try {
        const out = await webSearch("https://searx.example/", {
            query: "x",
            max_results: 5,
        });
        assert.equal(out, "No results found.");
    } finally {
        globalThis.fetch = fetched;
    }
});

test("handler fails when SEARX_URL is not set", async () => {
    const tool = tools.find((t) => t.name === "web-search");
    assert.ok(tool);
    const saved = process.env.SEARX_URL;
    delete process.env.SEARX_URL;
    try {
        const result = await (tool.handler as (i: any) => any)({
            query: "test",
            max_results: 5,
        });
        assert.match(result.content[0].text, /SEARX_URL environment variable/);
    } finally {
        if (saved === undefined) {
            delete process.env.SEARX_URL;
        } else {
            process.env.SEARX_URL = saved;
        }
    }
});

test("throws on invalid JSON", async () => {
    const fetched = globalThis.fetch;
    globalThis.fetch = async () =>
        ({ text: async () => "not json" }) as Response;
    try {
        await assert.rejects(() =>
            webSearch("https://searx.example/", {
                query: "x",
                max_results: 5,
            }),
        );
    } finally {
        globalThis.fetch = fetched;
    }
});

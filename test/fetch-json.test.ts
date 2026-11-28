import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { fetchJson } from "../src/tools/fetch-json.js";
import { tools } from "../src/tools/index.js";
import undici from "undici";
import { mockDns, restoreDns } from "./dns-mock.js";

before(mockDns);
after(restoreDns);

function jsonBody(body: unknown): undici.Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(body),
  } as undici.Response;
}

test("returns the JSON body as a string", async () => {
  undici.fetch = async () => jsonBody({ hello: "world", n: 42 }) as undici.Response;
  try {
    const out = await fetchJson("https://api.example.com/data");
    assert.deepEqual(JSON.parse(out), { hello: "world", n: 42 });
  } finally {
    undici.fetch = async () => jsonBody({});
  }
});

test("defaults to GET", async () => {
  const original = undici.fetch;
  undici.fetch = async (_url, init?) => {
    assert.equal(init?.method, undefined);
    return jsonBody({ ok: true }) as undici.Response;
  };
  try {
    await fetchJson("https://api.example.com/data");
  } finally {
    undici.fetch = original;
  }
});

test("throws on non-2xx response", async () => {
  undici.fetch = async () =>
    ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    }) as undici.Response;
  try {
    await assert.rejects(() => fetchJson("https://api.example.com/missing"), /HTTP 404/);
  } finally {
    undici.fetch = async () => jsonBody({});
  }
});

test("throws when body exceeds max_bytes", async () => {
  undici.fetch = async () =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ data: "x".repeat(5000) }),
    }) as undici.Response;
  try {
    await assert.rejects(
      () => fetchJson("https://api.example.com/big", { max_bytes: 100 }),
      /exceeds 100 bytes/,
    );
  } finally {
    undici.fetch = async () => jsonBody({});
  }
});

test("throws on invalid JSON", async () => {
  const original = undici.fetch;
  undici.fetch = async () =>
    ({ ok: true, status: 200, statusText: "OK", text: async () => "not json" }) as undici.Response;
  try {
    await assert.rejects(() => fetchJson("https://api.example.com/bad"), /invalid JSON/);
  } finally {
    undici.fetch = original;
  }
});

test("is registered in the tool list", async () => {
  const tool = tools.find((t) => t.name === "fetch-json");
  assert.ok(tool, "fetch-json should be registered");
  assert.equal(tool?.title, "Fetch JSON");
  assert.ok(tool?.inputSchema);
});

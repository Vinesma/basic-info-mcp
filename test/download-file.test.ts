import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import { downloadFile } from "../src/tools/download-file.js";
import { tools } from "../src/tools/index.js";
import undici from "undici";
import { mockDns, restoreDns } from "./dns-mock.js";

before(mockDns);
after(restoreDns);

function bytesResponse(
  body: Uint8Array,
  contentType = "application/octet-stream",
): undici.Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (_name: string) => contentType },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  } as undici.Response;
}

test("returns a base64 data URI", async () => {
  undici.fetch = async () => bytesResponse(new TextEncoder().encode("hello")) as undici.Response;
  try {
    const out = await downloadFile("https://example.com/file.txt");
    assert.match(out, /^data:application\/octet-stream;base64,/);
    const b64 = out.replace(/^data:.*;base64,/, "");
    assert.equal(Buffer.from(b64, "base64").toString("utf8"), "hello");
  } finally {
    undici.fetch = async () => bytesResponse(new Uint8Array());
  }
});

test("uses the provided mime_type hint", async () => {
  undici.fetch = async () =>
    bytesResponse(new TextEncoder().encode("x"), "text/plain") as undici.Response;
  try {
    const out = await downloadFile("https://example.com/a", {
      mime_type: "image/png",
    });
    assert.match(out, /^data:image\/png;base64,/);
  } finally {
    undici.fetch = async () => bytesResponse(new Uint8Array());
  }
});

test("defaults mime_type from Content-Type when not given", async () => {
  undici.fetch = async () =>
    bytesResponse(new TextEncoder().encode("y"), "image/png; charset=binary") as undici.Response;
  try {
    const out = await downloadFile("https://example.com/b");
    assert.match(out, /^data:image\/png;base64,/);
  } finally {
    undici.fetch = async () => bytesResponse(new Uint8Array());
  }
});

test("throws on non-2xx response", async () => {
  undici.fetch = async () =>
    ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    }) as unknown as undici.Response;
  try {
    await assert.rejects(() => downloadFile("https://example.com/sec"), /HTTP 403/);
  } finally {
    undici.fetch = async () => bytesResponse(new Uint8Array());
  }
});

test("throws when body exceeds max_bytes", async () => {
  undici.fetch = async () => bytesResponse(new Uint8Array(10_000)) as undici.Response;
  try {
    await assert.rejects(
      () => downloadFile("https://example.com/big", { max_bytes: 100 }),
      /exceeds 100 bytes/,
    );
  } finally {
    undici.fetch = async () => bytesResponse(new Uint8Array());
  }
});

test("is registered in the tool list", async () => {
  const tool = tools.find((t) => t.name === "download-file");
  assert.ok(tool, "download-file should be registered");
  assert.equal(tool?.title, "Download File");
  assert.ok(tool?.inputSchema);
});

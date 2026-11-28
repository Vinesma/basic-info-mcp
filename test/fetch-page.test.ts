import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { fetchPage } from "../src/tools/fetch-page.js";
import { tools } from "../src/tools/index.js";
import undici from "undici";
import { mockDns, restoreDns } from "./dns-mock.js";

before(mockDns);
after(restoreDns);

function htmlPage(html: string, contentType = "text/html"): undici.Response {
  return {
    headers: { get: (_name: string) => contentType },
    text: async () => html,
  } as undici.Response;
}

test("extracts readable text and strips markup", async () => {
  undici.fetch = async () =>
    htmlPage(`
        <html><head><title>Title</title><style>.x{color:red}</style></head>
        <body>
          <nav><a href="#">Nav</a></nav>
          <script>alert('hi')</script>
          <main><h1>Hello</h1><p>World paragraph.</p></main>
        </body></html>
    `) as undici.Response;
  try {
    const out = await fetchPage("https://example.com/page");
    assert.match(out, /Hello/);
    assert.match(out, /World paragraph\./);
    // nav/script stripped
    assert.doesNotMatch(out, /<nav/);
    assert.doesNotMatch(out, /alert\(/);
    assert.doesNotMatch(out, /<h1>/);
    assert.doesNotMatch(out, /Nav/);
  } finally {
    undici.fetch = async () => htmlPage("<body></body>");
  }
});

test("returns a note when there is no text", async () => {
  undici.fetch = async () => htmlPage("<body><div></div></body>") as undici.Response;
  try {
    const out = await fetchPage("https://example.com/empty");
    assert.equal(out, "page returned no text content");
  } finally {
    undici.fetch = async () => htmlPage("<body></body>");
  }
});

test("throws on non-HTML content type", async () => {
  undici.fetch = async () => htmlPage('{"a":1}', "application/json") as undici.Response;
  try {
    await assert.rejects(() => fetchPage("https://example.com/data"), /not HTML/);
  } finally {
    undici.fetch = async () => htmlPage("<body></body>");
  }
});

test("truncates text over max_bytes", async () => {
  undici.fetch = async () =>
    htmlPage("<body><p>" + "word ".repeat(5000) + "</p></body>") as undici.Response;
  try {
    const out = await fetchPage("https://example.com/big", { max_bytes: 200 });
    assert.match(out, /\[truncated: exceeds 200 bytes/);
  } finally {
    undici.fetch = async () => htmlPage("<body></body>");
  }
});

test("is registered in the tool list", async () => {
  const tool = tools.find((t) => t.name === "fetch-page");
  assert.ok(tool, "fetch-page should be registered");
  assert.equal(tool?.title, "Fetch Page");
  assert.ok(tool?.inputSchema);
});

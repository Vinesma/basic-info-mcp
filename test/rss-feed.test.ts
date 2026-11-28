import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { rssFeed } from "../src/tools/rss-feed.js";
import { tools } from "../src/tools/index.js";
import undici from "undici";
import { mockDns, restoreDns } from "./dns-mock.js";

before(mockDns);
after(restoreDns);

function xmlResponse(xml: string): undici.Response {
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => xml,
    } as undici.Response;
}

const RSS = `
<rss version="2.0">
  <channel>
    <title>Sample Blog</title>
    <item>
      <title>First Post</title>
      <link>https://example.com/1</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <description>First post description</description>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/2</link>
    </item>
  </channel>
</rss>`;

const ATOM = `
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Release Feed</title>
  <entry>
    <title>Version 1.0</title>
    <link rel="alternate" href="https://example.com/releases/1"/>
    <updated>2024-01-01T00:00:00Z</updated>
  </entry>
</feed>`;

test("parses an RSS feed", async () => {
    undici.fetch = async () => xmlResponse(RSS) as undici.Response;
    try {
        const out = await rssFeed("https://example.com/feed.xml");
        assert.match(out, /^Sample Blog/);
        assert.match(out, /1\. First Post/);
        assert.match(out, /URL: https:\/\/example\.com\/1/);
        assert.match(out, /Date: Mon, 01 Jan 2024/);
        assert.match(out, /First post description/);
        assert.match(out, /2\. Second Post/);
    } finally {
        undici.fetch = async () => xmlResponse("<rss><channel></channel></rss>");
    }
});

test("parses an Atom feed", async () => {
    undici.fetch = async () => xmlResponse(ATOM) as undici.Response;
    try {
        const out = await rssFeed("https://example.com/atom.xml");
        assert.match(out, /^Release Feed/);
        assert.match(out, /1\. Version 1\.0/);
        assert.match(out, /URL: https:\/\/example\.com\/releases\/1/);
        assert.match(out, /Date: 2024-01-01T00:00:00Z/);
    } finally {
        undici.fetch = async () => xmlResponse("<feed></feed>");
    }
});

test("returns a note when there are no items", async () => {
    undici.fetch = async () =>
        xmlResponse("<rss><channel><title>T</title></channel></rss>") as undici.Response;
    try {
        const out = await rssFeed("https://example.com/empty.xml");
        assert.equal(out, "feed returned no items");
    } finally {
        undici.fetch = async () => xmlResponse("<rss><channel></channel></rss>");
    }
});

test("caps items at max_items", async () => {
    const many = "<rss><channel><title>T</title>" +
        Array.from({ length: 10 }, (_, i) => `<item><title>P${i}</title></item>`).join("") +
        "</channel></rss>";
    undici.fetch = async () => xmlResponse(many) as undici.Response;
    try {
        const out = await rssFeed("https://example.com/many.xml", { max_items: 3 });
        const count = out.split("\n").filter((l) => /^\d\./.test(l)).length;
        assert.equal(count, 3);
    } finally {
        undici.fetch = async () => xmlResponse("<rss><channel></channel></rss>");
    }
});

test("throws on non-2xx response", async () => {
    undici.fetch = async () =>
        ({ ok: false, status: 404, statusText: "Not Found", text: async () => "" }) as undici.Response;
    try {
        await assert.rejects(() => rssFeed("https://example.com/missing"), /HTTP 404/);
    } finally {
        undici.fetch = async () => xmlResponse("<rss><channel></channel></rss>");
    }
});

test("is registered in the tool list", async () => {
    const tool = tools.find((t) => t.name === "rss-feed");
    assert.ok(tool, "rss-feed should be registered");
    assert.equal(tool?.title, "RSS Feed");
    assert.ok(tool?.inputSchema);
});

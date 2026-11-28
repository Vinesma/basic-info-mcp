import { test } from "node:test";
import assert from "node:assert/strict";

import { isPublicIp, resolveAndValidate, resolver } from "../src/tools/ssrf.js";

interface Addr {
  address: string;
  family: number;
}
const addr = (address: string): Addr =>
  ({ address, family: address.includes(".") ? 4 : 6 }) as Addr;

// dns.lookup is writable but non-configurable on the ESM namespace, so
// mock.method (which uses defineProperty) fails; reassign directly instead.
interface LookupHolder {
  lookup: (...args: any[]) => any;
}
const lookupHolder = resolver as unknown as LookupHolder;

async function withDnsLookup(addresses: Addr[], fn: () => Promise<void>): Promise<void> {
  const original = lookupHolder.lookup;
  lookupHolder.lookup = async () => addresses;
  try {
    await fn();
  } finally {
    lookupHolder.lookup = original;
  }
}

test("isPublicIp: public IPv4", () => {
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("93.184.216.137"), true);
});

test("isPublicIp: private / loopback / link-local / unspecified IPv4", () => {
  assert.equal(isPublicIp("10.0.0.1"), false);
  assert.equal(isPublicIp("172.16.5.4"), false);
  assert.equal(isPublicIp("192.168.1.1"), false);
  assert.equal(isPublicIp("127.0.0.1"), false);
  assert.equal(isPublicIp("169.254.169.254"), false);
  assert.equal(isPublicIp("0.0.0.0"), false);
});

test("isPublicIp: CGNAT 100.64.0.0/10", () => {
  assert.equal(isPublicIp("100.64.1.1"), false);
  assert.equal(isPublicIp("100.64.0.0"), false);
  assert.equal(isPublicIp("100.127.255.255"), false);
  // Adjacent ranges are still public.
  assert.equal(isPublicIp("100.63.255.255"), true);
  assert.equal(isPublicIp("100.128.0.0"), true);
});

test("isPublicIp: IPv6 ranges", () => {
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
  assert.equal(isPublicIp("::1"), false);
  assert.equal(isPublicIp("::"), false);
  assert.equal(isPublicIp("fd00::1234"), false);
  assert.equal(isPublicIp("fc00::1"), false);
  assert.equal(isPublicIp("fe80::1"), false);
  assert.equal(isPublicIp("ff00::1"), false);
});

test("resolveAndValidate: rejects non-http(s) schemes", async () => {
  await assert.rejects(() => resolveAndValidate("ftp://example.com/file"), /unsupported scheme/);
  await assert.rejects(() => resolveAndValidate("file:///etc/passwd"), /unsupported scheme/);
  await assert.rejects(() => resolveAndValidate("gopher://127.0.0.1"), /unsupported scheme/);
});

test("resolveAndValidate: rejects invalid URLs", async () => {
  await assert.rejects(() => resolveAndValidate("not a url"), /invalid URL/);
});

test("resolveAndValidate: accepts a public IPv4 literal", async () => {
  const res = await resolveAndValidate("http://8.8.8.8/data");
  assert.deepEqual(res.addresses, ["8.8.8.8"]);
});

test("resolveAndValidate: rejects an IPv4 literal in a private range", async () => {
  await assert.rejects(
    () => resolveAndValidate("http://127.0.0.1:8080/health"),
    /resolved to a private\/local IP 127.0.0.1/,
  );
  await assert.rejects(
    () => resolveAndValidate("http://169.254.169.254/latest"),
    /resolved to a private\/local IP 169.254.169.254/,
  );
  await assert.rejects(
    () => resolveAndValidate("http://10.0.0.5/"),
    /resolved to a private\/local IP 10.0.0.5/,
  );
});

test("resolveAndValidate: rejects IPv6 literals", async () => {
  await assert.rejects(
    () => resolveAndValidate("http://[::1]/"),
    /resolved to a private\/local IP ::1/,
  );
  await assert.rejects(
    () => resolveAndValidate("http://[fd00::1]/"),
    /resolved to a private\/local IP fd00::1/,
  );
});

test("resolveAndValidate: resolves a hostname and checks the resolved IP", async () => {
  await withDnsLookup([addr("93.184.216.137")], async () => {
    const res = await resolveAndValidate("https://example.com/page");
    assert.deepEqual(res.addresses, ["93.184.216.137"]);
  });
});

test("resolveAndValidate: rejects a hostname resolving to a private IP (rebinding)", async () => {
  await withDnsLookup([addr("10.1.2.3")], async () => {
    await assert.rejects(
      () => resolveAndValidate("http://internal.example/"),
      /resolved to a private\/local IP 10.1.2.3/,
    );
  });
});

test("resolveAndValidate: rejects when any resolved address is private", async () => {
  await withDnsLookup([addr("93.184.216.137"), addr("127.0.0.1")], async () => {
    await assert.rejects(
      () => resolveAndValidate("http://dual.example/"),
      /resolved to a private\/local IP 127.0.0.1/,
    );
  });
});

test("resolveAndValidate: rejects a hostname resolving to CGNAT", async () => {
  await withDnsLookup([addr("100.64.1.1")], async () => {
    await assert.rejects(
      () => resolveAndValidate("http://cgnat.example/"),
      /resolved to a private\/local IP 100.64.1.1/,
    );
  });
});

test("resolveAndValidate: returns a pinned dispatcher for a hostname", async () => {
  await withDnsLookup([addr("93.184.216.137")], async () => {
    const res = await resolveAndValidate("https://example.com/page");
    assert.equal(res.addresses[0], "93.184.216.137");
    assert.equal(typeof res.dispatcher?.close, "function");
  });
});

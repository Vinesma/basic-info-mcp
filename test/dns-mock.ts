// Shared DNS mock for URL-tool tests.
//
// The URL-fetching tools validate each URL through resolveAndValidate(), which
// calls resolver.lookup() (node:dns/promises) before fetching. The network
// test suites stub globalThis.fetch but not DNS, so they hit real DNS (which
// fails in the sandbox). These helpers stub resolver.lookup with a fixed public
// address so validation passes without a real lookup.

import { resolver } from "../src/tools/ssrf.js";

interface Holder {
  lookup: () => Promise<unknown>;
}
const holder = resolver as unknown as Holder;
const originalLookup = holder.lookup;

// A public address that resolves for any hostname in tests.
const PUBLIC_ADDRESSES = [{ address: "93.184.216.137", family: 4 }];

export function mockDns(): void {
  holder.lookup = async () => PUBLIC_ADDRESSES;
}

export function restoreDns(): void {
  holder.lookup = originalLookup;
}

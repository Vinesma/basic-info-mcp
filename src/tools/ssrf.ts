// Shared SSRF guard for the URL-fetching tools.
//
// Validates that a URL uses an allowed scheme and points at a "public" IP.
// Hostnames are resolved with dns.lookup() before the request so that a name
// resolving to a private/loopback/link-local range (or rebinding between the
// lookup and the fetch) is caught. The pure IP classification is exported as
// isPublicIp() so it can be unit-tested without touching DNS.
//
// This is a code-level guard, not network-level egress filtering: it rejects
// common private ranges but does not maintain a curated allowlist (see AGENTS
// notes / audit).

import { lookup } from "node:dns/promises";
import * as net from "node:net";
import { Agent, buildConnector, type Dispatcher } from "undici";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

// dns.lookup is exported as a non-configurable binding on the ESM namespace,
// so tests can't rebind it in place. Wrap it in a mutable object so the DNS
// step can be mocked in isolation.
export const resolver = { lookup };

// Returns true when `s` is a literal IPv4 or IPv6 address (no DNS needed).
function isLiteralIp(s: string): boolean {
    return net.isIPv4(s) || net.isIPv6(s);
}

// Classify a resolved address. Returns true for a usable public address.
// The IPv4Is* helpers are not always present on the `net` module, so classify
// the ranges explicitly here.
export function isPublicIp(addr: string): boolean {
    if (net.isIPv4(addr)) {
        const octets = addr.split(".").map(Number);
        const [a, b] = octets;
        if (a === 0) return false; // 0.0.0.0/8 unspecified
        if (a === 10) return false; // 10.0.0.0/8 private
        if (a === 127) return false; // 127.0.0.0/8 loopback
        if (a === 169 && b === 254) return false; // 169.254.0.0/16 link-local
        if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12 private
        if (a === 192 && b === 168) return false; // 192.168.0.0/16 private
        if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 CGNAT
        if (a >= 224) return false; // 224.0.0.0/4 multicast, 240.0.0.0/4 special
        return true;
    }
    if (net.isIPv6(addr)) {
        const groups = expandIPv6(addr);
        const allZero = groups.every((g) => parseInt(g, 16) === 0);
        if (allZero) return false; // :: / ::0 unspecified
        if (groups[0] === "0" && groups[groups.length - 1] === "1") return false; // ::1 loopback
        const first = parseInt(groups[0], 16);
        if ((first & 0xfe80) === 0xfc00) return false; // fc00::/7 unique local
        if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
        if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast
        return true;
    }
    return false;
}

// Expand a possibly-compressed IPv6 address into its 8 hextets.
function expandIPv6(addr: string): string[] {
    const [headStr, ...rest] = addr.split("::");
    const head = headStr ? headStr.split(":") : [];
    const tail = rest[0] ? rest[0].split(":") : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return head.concat(tail);
    return head.concat(Array(missing).fill("0").concat(tail));
}

// Build an undici dispatcher that dials a specific validated IP for a given
// hostname, closing the TOCTOU window between resolveAndValidate()'s DNS
// lookup and fetch()'s re-resolution. The URL's Host header and SNI are left
// untouched, so TLS validation still matches the name even though the TCP
// connection goes to a pinned IP.
function createPinnedDispatcher(host: string, addresses: string[]): Agent {
    const byHost = new Map<string, string[]>();
    byHost.set(host.toLowerCase(), addresses);
    byHost.set(host, addresses);

    return new Agent({
        connect: (
            options: buildConnector.Options,
            callback: buildConnector.Callback,
        ) => {
            const ips =
                byHost.get((options.host ?? "").toLowerCase()) ?? addresses;
            const ip = ips[0];
            const family = net.isIPv4(ip) ? 4 : 6;
            const port: number = Number(options.port) || 443;
            const opts: net.TcpNetConnectOpts = {
                host: ip,
                port,
                family,
            };
            const listener = (err: Error | null, sock: net.Socket) =>
                callback(null, sock);
            return net.connect(
                opts as net.NetConnectOpts,
                listener as () => void,
            );
        },
    });
}

export interface ValidationResult {
    host: string;
    addresses: string[];
    // When `host` was resolved from DNS (not a literal), this dispatcher pins
    // the fetch to one of the validated addresses, closing the TOCTOU window
    // between resolveAndValidate()'s lookup and fetch()'s re-resolution.
    dispatcher?: Dispatcher;
}

// Validate `url`: allowed scheme, then a public IP literal or hostname.
// Throws with a human-readable message on any failure.
export async function resolveAndValidate(url: string): Promise<ValidationResult> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`invalid URL: ${url}`);
    }

    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
        throw new Error(`unsupported scheme "${parsed.protocol}" for ${url}`);
    }

    // URL.hostname keeps brackets for IPv6 literals ("[::1]"); strip them so
    // isLiteralIp()/isPublicIp() classify the bare address.
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    let addresses: string[];
    let dispatcher: Dispatcher | undefined;
    if (isLiteralIp(host)) {
        // An IP literal cannot rebound; no need to pin the fetch.
        addresses = [host];
    } else {
        const results = await resolver.lookup(host, { all: true });
        addresses = results.map((r) => r.address);
        dispatcher = createPinnedDispatcher(host, addresses);
    }

    for (const addr of addresses) {
        if (!isPublicIp(addr)) {
            throw new Error(
                `hostname ${host} resolved to a private/local IP ${addr} for ${url}`,
            );
        }
    }

    return { host, addresses, dispatcher };
}

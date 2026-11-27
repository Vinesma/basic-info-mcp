// Fetch a URL and return its JSON body as a string.
// Dependency-light: uses the global fetch API (Node >= 20).

import { resolveAndValidate } from "./ssrf.js";

export interface FetchJsonParams {
    max_bytes?: number;
}

export async function fetchJson(url: string, params: FetchJsonParams = {}): Promise<string> {
    const maxBytes = params.max_bytes ?? 100_000;
    await resolveAndValidate(url);

    let response: Response;
    try {
        response = await fetch(url);
    } catch (err) {
        throw new Error(`fetch failed: ${url} (${(err as Error).message})`);
    }

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status} ${response.statusText} for ${url}`,
        );
    }

    const body = await response.text();
    const byteLength = new TextEncoder().encode(body).length;
    if (byteLength > maxBytes) {
        throw new Error(
            `response body exceeds ${maxBytes} bytes (${byteLength} bytes) for ${url}`,
        );
    }

    let data: unknown;
    try {
        data = JSON.parse(body);
    } catch (err) {
        throw new Error(
            `invalid JSON from ${url}: ${(err as Error).message}`,
        );
    }

    return JSON.stringify(data);
}

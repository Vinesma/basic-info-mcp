// Fetch a URL and return its bytes as a base64 data URI.
// Returns the bytes inline (rather than writing to disk) so agents running in
// a sandbox can read the result even when the MCP server's output dir is
// unreachable from the agent side.

import { resolveAndValidate } from "./ssrf.js";
import type { Dispatcher } from "undici";

type FetchInit = RequestInit & { dispatcher?: Dispatcher };

export interface DownloadFileParams {
    max_bytes?: number;
    mime_type?: string;
}

export async function downloadFile(
    url: string,
    params: DownloadFileParams = {},
): Promise<string> {
    const maxBytes = params.max_bytes ?? 5_000_000;
    const { dispatcher } = await resolveAndValidate(url);

    const init: FetchInit = dispatcher ? { dispatcher } : {};
    let response: Response;
    try {
        response = await fetch(url, init);
    } catch (err) {
        throw new Error(`fetch failed: ${url} (${(err as Error).message})`);
    }

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status} ${response.statusText} for ${url}`,
        );
    }

    const buffer = await response.arrayBuffer();
    const byteLength = buffer.byteLength;
    if (byteLength > maxBytes) {
        throw new Error(
            `response body exceeds ${maxBytes} bytes (${byteLength} bytes) for ${url}`,
        );
    }

    const mimeType =
        params.mime_type ??
        (response.headers.get("content-type") ?? "").split(";")[0].trim();

    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${mimeType || ""};base64,${base64}`;
}

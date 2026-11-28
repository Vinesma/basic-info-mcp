// Fetch a URL and return its JSON body as a string.
// Dependency-light: uses undici's fetch (same realm as the pinned dispatcher)
// so the dispatcher from resolveAndValidate() is accepted by fetch().

import { closeDispatcher, resolveAndValidate } from "./ssrf.js";
import undici, { type RequestInit as UndiciInit } from "undici";

type FetchInit = UndiciInit;

export interface FetchJsonParams {
  max_bytes?: number;
}

export async function fetchJson(url: string, params: FetchJsonParams = {}): Promise<string> {
  const maxBytes = params.max_bytes ?? 100_000;
  const { dispatcher } = await resolveAndValidate(url);

  const init: FetchInit = dispatcher ? { dispatcher } : {};
  let response: Awaited<ReturnType<typeof undici.fetch>>;
  try {
    response = await undici.fetch(url, init);
  } catch (err) {
    throw new Error(`fetch failed: ${url} (${(err as Error).message})`, {
      cause: err,
    });
  }

  try {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    }

    const body = await response.text();
    const byteLength = new TextEncoder().encode(body).length;
    if (byteLength > maxBytes) {
      throw new Error(`response body exceeds ${maxBytes} bytes (${byteLength} bytes) for ${url}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch (err) {
      throw new Error(`invalid JSON from ${url}: ${(err as Error).message}`, {
        cause: err,
      });
    }

    return JSON.stringify(data);
  } finally {
    await closeDispatcher(dispatcher);
  }
}

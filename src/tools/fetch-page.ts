// Fetch an HTML page and return clean, readable text.
// Uses jsdom to parse markup correctly (unclosed tags, entities) instead of a
// hand-rolled regex pipeline. jsdom does not run the page's own scripts, so
// content injected purely by client-side JS will be absent.

import { JSDOM } from "jsdom";

export interface FetchPageParams {
    max_bytes?: number;
    accept?: string;
}

const BLOCK_TAGS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "CAPTION",
    "DD", "DIV", "DL", "DT", "FIGCAPTION", "FIGURE", "FOOTER", "H1",
    "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV",
    "OL", "P", "PRE", "SECTION", "TABLE", "TD", "TH", "THEAD", "TBODY",
    "UL", "DT", "DD",
]);

const NOISE_TAGS = new Set([
    "SCRIPT", "STYLE", "HEAD", "NAV", "FOOTER", "HEADER", "ASIDE", "SVG",
    "CANVAS", "NOSCRIPT", "LINK", "META", "TEMPLATE", "IMAGE", "SOURCE",
    "OBJECT", "EMBED",
]);

// nodeType constants (Node is a browser global, not present in Node's runtime).
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function extractText(node: Node): string {
    const parts: string[] = [];
    for (const child of node.childNodes) {
        if (child.nodeType === TEXT_NODE) {
            parts.push(child.textContent ?? "");
        } else if (child.nodeType === ELEMENT_NODE) {
            const tag = (child as Element).tagName.toUpperCase();
            const isBlock = BLOCK_TAGS.has(tag);
            if (isBlock) parts.push("\n");
            parts.push(extractText(child));
            if (isBlock) parts.push("\n");
        }
    }
    return parts.join("");
}

function normalizeWhitespace(text: string): string {
    return text
        .replace(/[ \t\f\v ]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export async function fetchPage(url: string, params: FetchPageParams = {}): Promise<string> {
    const maxBytes = params.max_bytes ?? 50_000;
    const accept = params.accept ?? "text/html,application/xhtml+xml,*/*";

    let response: Response;
    try {
        response = await fetch(url, {
            headers: { Accept: accept },
        });
    } catch (err) {
        throw new Error(`fetch failed: ${url} (${(err as Error).message})`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) {
        throw new Error(`page is ${contentType || "unknown type"}, not HTML: ${url}`);
    }

    const html = await response.text();

    const dom = new JSDOM(html, { url, runScripts: "outside-only" });
    const { document } = dom.window;

    if (!document.body) {
        throw new Error("page returned no <body> content");
    }

    for (const tag of NOISE_TAGS) {
        for (const el of document.querySelectorAll(tag)) {
            el.remove();
        }
    }

    const rawText = extractText(document.body);
    const text = normalizeWhitespace(rawText);

    if (text.length === 0) {
        return "page returned no text content";
    }

    const byteLength = new TextEncoder().encode(text).length;
    if (byteLength > maxBytes) {
        const truncated = text.slice(0, maxBytes);
        return `${truncated}\n\n[truncated: exceeds ${maxBytes} bytes (${byteLength} bytes)]`;
    }

    return text;
}

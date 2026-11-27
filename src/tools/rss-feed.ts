// Fetch an RSS/Atom feed and render a clean list of items.
// Parses XML with jsdom's DOMParser (no extra deps). Tolerant of missing
// fields: absent elements are skipped rather than erroring.

import { JSDOM } from "jsdom";

import { resolveAndValidate } from "./ssrf.js";

// A DOMParser that parses XML so void elements (e.g. RSS <link>text</link>)
// keep their text content. JSDOM's default constructor parses as HTML.
interface DomParser {
    parseFromString(input: string, type: string): Document;
}
const dom = new JSDOM("<!DOCTYPE html>");
const { DOMParser } = dom.window as { DOMParser: new () => DomParser };

export interface FeedParams {
    max_items?: number;
}

interface FeedItem {
    title: string;
    link?: string;
    date?: string;
    description?: string;
}

function parseFeed(xml: string): { title: string; items: FeedItem[] } {
    const document = new DOMParser().parseFromString(xml, "application/xml");

    const feedRoot = document.querySelector("rss channel, feed");
    const rootTitle = (feedRoot?.querySelector("title")?.textContent ?? "").trim();
    const anyTitle = document.querySelector("title")?.textContent?.trim() ?? "";
    const feedTitle = rootTitle || anyTitle;

    const itemNodes = document.querySelectorAll("rss item, feed entry");
    const items: FeedItem[] = [];

    for (const node of itemNodes) {
        const title = (node.querySelector("title")?.textContent ?? "").trim();
        let link: string | undefined;
        const linkEl = node.querySelector("link");
        if (linkEl) {
            // Atom uses href; RSS uses text content.
            link = linkEl.getAttribute("href") ?? linkEl.textContent?.trim();
        }
        const date = (node.querySelector("pubDate, updated")?.textContent ?? "").trim();
        const description = (node.querySelector("description")?.textContent ?? "").trim();
        items.push({ title, link, date, description });
    }

    return { title: feedTitle, items };
}

export async function rssFeed(url: string, params: FeedParams = {}): Promise<string> {
    const maxItems = params.max_items ?? 20;
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

    const xml = await response.text();

    let parsed;
    try {
        parsed = parseFeed(xml);
    } catch (err) {
        throw new Error(`failed to parse feed ${url}: ${(err as Error).message}`);
    }

    if (parsed.items.length === 0) {
        return "feed returned no items";
    }

    const items = parsed.items.slice(0, maxItems);
    const parts = items.map((item, i) => {
        const line = [
            `${i + 1}. ${item.title || "(untitled)"}`,
            item.link ? `   URL: ${item.link}` : "",
            item.date ? `   Date: ${item.date}` : "",
            item.description ? `   ${item.description}` : "",
        ].filter(Boolean);
        return line.join("\n");
    });

    const header = parsed.title ? `${parsed.title}\n` : "";
    return `${header}${parts.join("\n")}`;
}

import * as z from "zod/v4";
import {
    McpServer,
    type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";

import { getDateTime } from "./datetime.js";
import { calculate } from "./calculate.js";
import { convertUnits } from "./convert.js";
import { webSearch } from "./web-search.js";
import { fetchJson } from "./fetch-json.js";
import { fetchPage } from "./fetch-page.js";
import { downloadFile } from "./download-file.js";
import { rssFeed } from "./rss-feed.js";

type TextResult = {
    content: Array<{ type: "text"; text: string }>;
};

function textResult(text: string): TextResult {
    return {
        content: [
            {
                type: "text",
                text,
            },
        ],
    };
}

interface ToolDef<InputArgs = any> {
    name: string;
    title?: string;
    description: string;
    inputSchema?: StandardSchemaWithJSON;
    handler: (input: InputArgs) => TextResult | Promise<TextResult>;
}

export const tools: ToolDef[] = [
    {
        name: "get-date-time",
        title: "Get Date Time",
        description:
            "Get the date and time. Use this when you need to know what the date and/or time is.",
        handler: () => {
            return textResult(getDateTime());
        },
    },
    {
        name: "calculate",
        title: "Calculate",
        description:
            "Evaluate a simple arithmetic expression such as '2 * (3 + 4)'. Only + - * / and parentheses are allowed.",
        inputSchema: z.object({
            expression: z
                .string()
                .describe("Arithmetic expression to evaluate."),
        }),
        handler: ({ expression }) => {
            return textResult(calculate(expression));
        },
    },
    {
        name: "convert-units",
        title: "Convert Units",
        description:
            "Convert a value between units of the same dimension. Dimensions: length, mass, volume, area, speed.",
        inputSchema: z.object({
            value: z.number().describe("Numeric value to convert."),
            from: z
                .string()
                .describe("Source unit, e.g. 'mi', 'kg', 'gal_us'."),
            to: z.string().describe("Target unit, e.g. 'km', 'lb', 'l'."),
            dimension: z
                .enum(["length", "mass", "volume", "area", "speed"])
                .describe("Measurement dimension."),
        }),
        handler: ({ value, from, to, dimension }) => {
            return textResult(convertUnits(value, from, to, dimension));
        },
    },
    {
        name: "web-search",
        title: "Web Search",
        description:
            "Search the web via a self-hosted SearXNG instance (JSON API) to get up-to-date information. Use when you need current facts, recent events, or information not already known. The instance URL comes from the SEARX_URL environment variable. The query is logged for visibility.",
        inputSchema: z.object({
            query: z
                .string()
                .describe("Search query passed to the search engines."),
            categories: z
                .string()
                .describe(
                    "Optional comma-separated search categories (e.g. 'general').",
                ),
            language: z
                .string()
                .describe("Optional language code, e.g. 'en', 'fr'."),
            time_range: z
                .enum(["day", "month", "year"])
                .describe("Optional recency filter for time-sensitive engines."),
            max_results: z
                .number()
                .int()
                .positive()
                .max(100)
                .default(10)
                .describe("Maximum number of results to return."),
        }),
        handler: async ({
            query,
            categories,
            language,
            time_range,
            max_results,
        }) => {
            const url = process.env.SEARX_URL;
            if (!url) {
                return textResult(
                    "SEARX_URL environment variable is not set; cannot run web search.",
                );
            }
            return textResult(
                await webSearch(url, {
                    query,
                    categories,
                    language,
                    time_range,
                    max_results,
                }),
            );
        },
    },
    {
        name: "fetch-json",
        title: "Fetch JSON",
        description:
            "Fetch a URL that returns JSON (an API or JSON endpoint) and return the parsed body. Use when you need to read structured data from a JSON endpoint. The response is validated as JSON and capped by max_bytes. Uses GET only and resolves the host before fetching (SSRF guard).",
        inputSchema: z.object({
            url: z.string().describe("URL of the JSON endpoint to fetch."),
            max_bytes: z
                .number()
                .int()
                .positive()
                .optional()
                .default(100_000)
                .describe("Maximum response body size in bytes before erroring."),
        }),
        handler: async ({ url, method, max_bytes }) => {
            return textResult(await fetchJson(url, { max_bytes }));
        },
    },
    {
        name: "fetch-page",
        title: "Fetch Page",
        description:
            "Fetch an HTML page and return its clean, readable text (markup, scripts, and navigation stripped). Use when you need the readable content of a web page rather than the raw HTML. Content is capped by max_bytes.",
        inputSchema: z.object({
            url: z.string().describe("URL of the page to fetch."),
            max_bytes: z
                .number()
                .int()
                .positive()
                .optional()
                .default(50_000)
                .describe("Maximum readable text size in bytes before truncating."),
            accept: z
                .string()
                .optional()
                .describe("Value for the Accept header, default 'text/html'."),
        }),
        handler: async ({ url, max_bytes, accept }) => {
            return textResult(await fetchPage(url, { max_bytes, accept }));
        },
    },
    {
        name: "download-file",
        title: "Download File",
        description:
            "Download a file from a URL and return it as a base64 data URI (data:<mime>;base64,...). Use when you need the raw bytes of a file (image, PDF, CSV, etc.) inline, e.g. for a sandboxed agent that cannot read a file the server wrote to disk. Capped by max_bytes.",
        inputSchema: z.object({
            url: z.string().describe("URL of the file to download."),
            max_bytes: z
                .number()
                .int()
                .positive()
                .optional()
                .default(5_000_000)
                .describe("Maximum file size in bytes before erroring."),
            mime_type: z
                .string()
                .optional()
                .describe("Optional MIME type hint; defaults to the response Content-Type."),
        }),
        handler: async ({ url, max_bytes, mime_type }) => {
            return textResult(await downloadFile(url, { max_bytes, mime_type }));
        },
    },
    {
        name: "rss-feed",
        title: "RSS Feed",
        description:
            "Fetch an RSS or Atom feed and return a clean list of items (title, link, date, description). Use when you want to read a blog, news, or release feed. Handles both RSS <item> and Atom <entry> entries. Capped by max_items.",
        inputSchema: z.object({
            url: z.string().describe("URL of the RSS or Atom feed."),
            max_items: z
                .number()
                .int()
                .positive()
                .optional()
                .default(20)
                .describe("Maximum number of items to return."),
        }),
        handler: async ({ url, max_items }) => {
            return textResult(await rssFeed(url, { max_items }));
        },
    },
];

export function buildServer(): McpServer {
    const server = new McpServer({
        name: "basic-info-mcp",
        version: "1.0.0",
    });

    for (const tool of tools) {
        const handler = tool.handler;
        const loggedHandler = async (input: any) => {
            const start = Date.now();
            const url =
                input && typeof input === "object" && "url" in input
                    ? String((input as { url: unknown }).url)
                    : undefined;
            try {
                const result = await handler(input);
                const byteLength = new TextEncoder()
                    .encode(result.content[0]?.text ?? "")
                    .length;
                console.log(
                    JSON.stringify({
                        ts: new Date().toISOString(),
                        tool: tool.name,
                        url,
                        status: "ok",
                        bytes: byteLength,
                        duration_ms: Date.now() - start,
                    }),
                );
                return result;
            } catch (err) {
                console.error(
                    JSON.stringify({
                        ts: new Date().toISOString(),
                        tool: tool.name,
                        url,
                        status: "error",
                        error: (err as Error).message,
                        duration_ms: Date.now() - start,
                    }),
                );
                throw err;
            }
        };
        server.registerTool(
            tool.name,
            {
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
            },
            loggedHandler,
        );
    }

    return server;
}

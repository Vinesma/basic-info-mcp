import * as z from "zod/v4";
import {
    McpServer,
    type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";

import { getDateTime } from "./datetime.js";
import { calculate } from "./calculate.js";
import { convertUnits } from "./convert.js";
import { webSearch } from "./web-search.js";

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
            "Search the web via a self-hosted SearXNG instance (JSON API) to get up-to-date information. Use when you need current facts, recent events, or information not already known. The instance URL comes from the SEARX_URL environment variable.",
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
];

export function buildServer(): McpServer {
    const server = new McpServer({
        name: "basic-info-mcp",
        version: "1.0.0",
    });

    for (const tool of tools) {
        server.registerTool(
            tool.name,
            {
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
            },
            tool.handler,
        );
    }

    return server;
}

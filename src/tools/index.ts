import * as z from "zod/v4";
import {
    McpServer,
    type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";

import { getDateTime } from "./datetime.js";
import { calculate } from "./calculate.js";
import { convertUnits } from "./convert.js";

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
    handler: (input: InputArgs) => TextResult;
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

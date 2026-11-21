import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { getDateTime } from "./tools/datetime.js";
import { calculate } from "./tools/calculate.js";
import { convertUnits } from "./tools/convert.js";

const server = new McpServer({
    name: "basic-info-mcp",
    version: "1.0.0",
});

server.registerTool(
    "get-date-time",
    {
        title: "Get Date Time",
        description:
            "Get the date and time. Use this when you need to know what the date and/or time is.",
    },
    () => {
        return {
            content: [
                {
                    type: "text",
                    text: getDateTime(),
                },
            ],
        };
    },
);

server.registerTool(
    "calculate",
    {
        title: "Calculate",
        description:
            "Evaluate a simple arithmetic expression such as '2 * (3 + 4)'. Only + - * / and parentheses are allowed.",
        inputSchema: z.object({
            expression: z
                .string()
                .describe("Arithmetic expression to evaluate."),
        }),
    },
    ({ expression }) => {
        return {
            content: [
                {
                    type: "text",
                    text: calculate(expression),
                },
            ],
        };
    },
);

server.registerTool(
    "convert-units",
    {
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
    },
    ({ value, from, to, dimension }) => {
        return {
            content: [
                {
                    type: "text",
                    text: convertUnits(value, from, to, dimension),
                },
            ],
        };
    },
);

const transport = new StdioServerTransport();

await server.connect(transport);
console.info("Basic Info MCP server is running over stdio.");

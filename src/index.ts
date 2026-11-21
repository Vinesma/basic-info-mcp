import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
// import * as z from "zod/v4";

import { getDateTime } from "./tools.js";

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

const transport = new StdioServerTransport();

await server.connect(transport);
console.info("Basic Info MCP server is running over stdio.");

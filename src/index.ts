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

// server.registerTool(
//     "get-order-status",
//     {
//         title: "Get order status",
//         description:
//             "Look up a customer order by its order ID and return its status, items, and delivery date. Use this whenever the user asks about a specific order.",
//         inputSchema: z.object({
//             orderId: z
//                 .string()
//                 .regex(/^ORD-\d{4}$/)
//                 .describe("The order ID, such as ORD-1042."),
//         }),
//     },
//     async ({ orderId }) => {
//         const order = getOrderStatus(orderId);
//
//         if (!order) {
//             return {
//                 content: [
//                     {
//                         type: "text",
//                         text: `No order found with ID ${orderId}.`,
//                     },
//                 ],
//             };
//         }
//
//         return {
//             content: [
//                 {
//                     type: "text",
//                     text: formatOrder(order),
//                 },
//             ],
//         };
//     },
// );

const transport = new StdioServerTransport();

await server.connect(transport);
console.info("Basic Info MCP server is running over stdio.");

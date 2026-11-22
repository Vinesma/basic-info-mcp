import "dotenv/config";
import { serve } from "@hono/node-server";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { buildServer } from "./tools/index.js";

const handler = createMcpHandler(buildServer);

const hostname = process.env.HOST;
const port = Number(process.env.PORT) || 8080;

const app = createMcpHonoApp({
    host: hostname,
    allowedHosts: ["host.docker.internal"],
});
app.get("/health", c => c.json({ status: "ok" }));
app.all("/mcp", c => handler.fetch(c.req.raw));

serve({ fetch: app.fetch, port, hostname }, () => {
    console.error(
        `[basic-info-mcp-server] listening on http://127.0.0.1:${port}/mcp`,
    );
});

# AGENTS.md

Notes for agents working on **basic-info-mcp** — a small MCP (Model Context
Protocol) server in TypeScript that exposes a few tools to AI agents:
getting the date/time, evaluating arithmetic expressions, converting units, among others.

## Layout

```
src/
  index.ts            HTTP entrypoint (Hono + @hono/node-server), /health + /mcp
  tools/
    index.ts          Tool registry + buildServer() (the single source of tools)
    datetime.ts       getDateTime()
    calculate.ts      calculate() — arithmetic expression evaluator
    convert.ts        convertUnits() — unit conversion tables
test/                 node:test suites (one per tool + registry)
```

## Concepts

- **Tool** = a pure function (in `src/tools/*.ts`) plus a registry entry in
  `src/tools/index.ts` that describes its name, title, description, input
  schema, and handler.
- **Registry-driven**: `buildServer()` iterates the `tools` array and calls
  `server.registerTool(...)` for each. There is exactly one place to register
  a tool.
- The server is served over HTTP (`/mcp` is the MCP endpoint; `/health` is a
  plain JSON health check). `HOST`/`PORT` come from env (see `.env.example`).

## Setup / run

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # node:test via tsx
npm start           # run the server
```

Copy `.env.example` to `.env` and set `HOST`/`PORT` before running. `.env` is
gitignored.

## How to add a new tool

1. Write the pure logic in `src/tools/<name>.ts` and export a function. Keep it
   dependency-free and side-effect free where possible.
2. Add an entry to the `tools` array in `src/tools/index.ts`. The handler
   receives the validated input object (per `inputSchema`) and returns a text
   result via the shared `textResult()` helper:

   ```ts
   {
     name: "my-tool",
     title: "My Tool",
     description: "What the agent should use it for and when.",
     inputSchema: z.object({
       arg: z.string().describe("..."),
     }),
     handler: ({ arg }) => textResult(/* string response */),
   },
   ```

   - `inputSchema` is optional; omit it for tools with no arguments
     (e.g. `get-date-time`).
   - Keep `description` agent-facing: describe purpose, when to use it, and any
     constraints (units, allowed characters, etc.).
3. Add a test in `test/<name>.test.ts`.
4. Run `npm run typecheck` and `npm test`.

## How to add a test

- Use `node:test` (`import { test } from "node:test"`) and
  `node:assert/strict`.
- One file per tool or feature under `test/`. Files are auto-discovered by the
  `npm test` script (`node --import tsx --test test/*.test.ts`).
- Prefer deterministic assertions. For conversions, assert exact formatted
  strings (the formatter uses `toPrecision(12)`); for errors, assert that a
  value throws.

## Conventions

- Keep tools pure and unit-testable; put formatting/tables close to the logic.
- ESM only (`"type": "module"`, `NodeNext`); import siblings with `.js`
  extensions.
- `strict` tsconfig — no `any` in `src/` (the registry intentionally uses a
  loose `InputArgs` for handler variance).
- When the MCP SDK updates, check `node_modules/@modelcontextprotocol/server`
  types; `registerTool` expects `(args) => { content: [...] }`.

## Gotchas

- `convert.ts` maps each unit to a base multiplier; a wrong multiplier produces
  silently wrong conversions (e.g. the `cm3` fix). Test conversions that are
  easy to get wrong.
- `calculate()` validates with a regex then uses `new Function`. It is safe
  against arbitrary code but not a full parser — document that trade-off.

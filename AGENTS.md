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
    *.ts              Tools get added here as a new .ts file.
test/                 node:test suites (one per tool + registry)
systemd/              Systemd service file for running the docker compose
.github               Github actions
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

## Setup / run (Docker)

```bash
docker compose up -d --build
```

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

## Keep AGENTS.md useful

- This file is written for future agents, not just the current one. When you
  learn something non-obvious while working here — a gotcha, a convention that
  works, a dependency quirk, an env-var you discovered — add it so the next
  agent doesn't have to rediscover it. Prefer concrete, actionable notes over
  prose.
- If you are unsure whether something belongs here, err toward adding it; the
  file is a living log of hard-won context.

## Gotchas

- `calculate()` validates with a regex then uses `new Function`. It is safe
  against arbitrary code but not a full parser — document that trade-off.
- `registerTool`'s handler type accepts a sync or async return, so an `async`
  handler that `await`s `fetch` typechecks fine. If you define a local
  `handler: (input) => TextResult` shape, remember a `Promise<TextResult>` is
  not assignable to it.
- Tests import sibling modules with `.js` extensions (ESM resolution maps them
  to `.ts` via `tsx`). Add one `test/<name>.test.ts` per tool and keep the
  tool list in `test/tools.test.ts` in sync when registering a new tool.
- The Web tools are (`fetch-json`, `fetch-page`, `download-file`, `rss-feed`, `web-search`). The relevant gotchas while building them:
  - jsdom parses HTML by default, so void elements like RSS
    `<link>text</link>` lose their text content. For XML feeds, use
    `new DOMParser().parseFromString(xml, "application/xml")`.
  - `DOMParser` is a constructor, not a static method — call
    `new DOMParser().parseFromString(...)`. jsdom's `window.DOMParser` type also
    omits `parseFromString`, so cast the constructor.
  - `Node` is a browser global, not in Node's runtime. Use numeric `nodeType`
    constants (element `1`, text `3`).
  - `||` and `??` cannot be mixed without parentheses (TS5076).
  - `string.length` is characters, not bytes; use
    `new TextEncoder().encode(s).length` for a byte count.
  - `fetch-json`'s handler must `await` the fetch call — a sync handler that
    returns `textResult(fetchJson(...))` fails typecheck.

## What is this?

A basic MCP server that exposes simple tools for agents.

### How to use

#### Bare metal

```sh
npm install
npm start
```

#### Docker

```sh
docker compose up -d --build
```

Will set up everything. The server will be exposed in the port provided in `.env`.

Docker requires a network:

```sh
docker network create mcp-net
```

This is used so that my harness, which is also in Docker, can communicate with the MCP server.

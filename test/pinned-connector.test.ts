import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import * as net from "node:net";

import {
    createPinnedDispatcher,
    closeDispatcher,
} from "../src/tools/ssrf.js";

// Exercise the pinned connector end-to-end against a real local server so the
// net.connect('connect') callback path is actually exercised (not stubbed).
function startServer(body = "pinned-ok"): Promise<{
    port: number;
    close: () => Promise<void>;
}> {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(body);
        });
        server.listen(0, "127.0.0.1", () => {
            const addr = server.address();
            const port = typeof addr === "object" && addr ? addr.port : 0;
            resolve({
                port,
                close: () =>
                    new Promise((res2) => server.close(() => res2())),
            });
        });
    });
}

test("dials the pinned IP over plain http and returns the response", async () => {
    const server = await startServer();
    const dispatcher = createPinnedDispatcher("example.com", ["127.0.0.1"]);
    try {
        const { statusCode, body } = await dispatcher.request({
            method: "GET",
            origin: `http://127.0.0.1:${server.port}`,
            path: "/",
        });
        assert.equal(statusCode, 200);
        assert.equal(await body.text(), "pinned-ok");
    } finally {
        await closeDispatcher(dispatcher);
        await server.close();
    }
});

test("tries the next pinned address when the first fails to connect", async () => {
    const server = await startServer();
    // 127.0.0.2 has no listener on this port, so the connector should fall
    // back to 127.0.0.1 which serves the request.
    const dispatcher = createPinnedDispatcher("example.com", [
        "127.0.0.2",
        "127.0.0.1",
    ]);
    try {
        const { statusCode } = await dispatcher.request({
            method: "GET",
            origin: `http://127.0.0.1:${server.port}`,
            path: "/",
        });
        assert.equal(statusCode, 200);
    } finally {
        await closeDispatcher(dispatcher);
        await server.close();
    }
});

test("removes the error listener after a successful connect (no socket leak)", async () => {
    // Primary server on 127.0.0.1 serves the request, then writes one unread
    // byte and destroys the socket, forcing a client-side RST/error AFTER the
    // request has settled (see the post-settle RST gotcha).
    let primarySocket: net.Socket;
    const server = http.createServer((req, res) => {
        primarySocket = res.socket as net.Socket;
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("pinned-ok");
        setImmediate(() => {
            primarySocket.write("x"); // unread byte on the wire
            primarySocket.destroy(); // -> ECONNRESET on the client
        });
    });
    await new Promise<void>((res2) =>
        server.listen(0, "127.0.0.1", () => res2()),
    );
    const port = (server.address() as net.AddressInfo).port;

    // A second listener on 127.0.0.2:<same port> counts how many times the
    // connector dials the second pinned address after the first settled.
    let secondaryConnections = 0;
    const secondary = http.createServer();
    secondary.on("connection", () => {
        secondaryConnections++;
    });
    await new Promise<void>((res3) =>
        secondary.listen(port, "127.0.0.2", () => res3()),
    );

    const dispatcher = createPinnedDispatcher("example.com", [
        "127.0.0.1",
        "127.0.0.2",
    ]);
    try {
        const { statusCode } = await dispatcher.request({
            method: "GET",
            origin: `http://127.0.0.1:${port}`,
            path: "/",
        });
        assert.equal(statusCode, 200);

        // Give the post-settle RST and any (buggy) extra dial a chance to land.
        await new Promise((r) => setTimeout(r, 150));
        assert.equal(
            secondaryConnections,
            0,
            "error listener should be removed after connect (no extra dial)",
        );
    } finally {
        await closeDispatcher(dispatcher);
        await new Promise<void>((r) => server.close(() => r()));
        await new Promise<void>((r) => secondary.close(() => r()));
    }
});

test("returns an error when every pinned address fails", async () => {
    const dispatcher = createPinnedDispatcher("example.com", [
        "127.0.0.2",
        "127.0.0.3",
    ]);
    try {
        await assert.rejects(
            () =>
                dispatcher.request({
                    method: "GET",
                    origin: "http://127.0.0.1:1",
                    path: "/",
                }),
            /all 2 pinned addresses failed/,
        );
    } finally {
        await closeDispatcher(dispatcher);
    }
});

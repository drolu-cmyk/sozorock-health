import assert from "node:assert/strict";
import test from "node:test";
import { handler } from "../src/handler.ts";

test("real-time service refuses all workspace mutations", async () => {
  const response = await handler({
    requestContext: {
      routeKey: "modify_plan",
      connectionId: "connection-1",
    },
  } as never);
  assert.equal(response.statusCode, 403);
  assert.match(String(response.body), /authenticated HTTPS API/);
});

test("connect fails closed without an opaque one-time session", async () => {
  process.env.SESSION_TABLE = "sessions";
  process.env.CONNECTION_TABLE = "connections";
  const response = await handler({
    headers: {},
    requestContext: {
      routeKey: "$connect",
      connectionId: "connection-1",
    },
  } as never);
  assert.equal(response.statusCode, 401);
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./app.js";

let server: FastifyInstance;

before(async () => {
  server = await buildServer(null, { logger: false });
  await server.ready();
});

after(async () => {
  await server.close();
});

test("health reports an unconfigured database", async () => {
  const response = await server.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    service: "danil-nails-api",
    database: "not_configured"
  });
});

test("public services fall back to seed data", async () => {
  const response = await server.inject({ method: "GET", url: "/v1/services" });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.source, "mock");
  assert.equal(body.services.length, 3);
});

test("database routes fail closed before configuration", async () => {
  const loginResponse = await server.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: "owner@example.com", password: "not-used" }
  });
  const clientsResponse = await server.inject({
    method: "GET",
    url: "/v1/admin/clients"
  });

  assert.equal(loginResponse.statusCode, 503);
  assert.equal(clientsResponse.statusCode, 503);
});

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

test("CORS preflight allows CRM mutation methods", async () => {
  const response = await server.inject({
    method: "OPTIONS",
    url: "/v1/admin/schedule/working-hours",
    headers: {
      origin: "http://localhost:3000",
      "access-control-request-method": "PUT",
      "access-control-request-headers": "content-type"
    }
  });
  const methods = response.headers["access-control-allow-methods"];

  assert.equal(response.statusCode, 204);
  assert.match(String(methods), /PUT/);
  assert.match(String(methods), /PATCH/);
  assert.match(String(methods), /DELETE/);
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
  const appointmentsResponse = await server.inject({
    method: "GET",
    url: "/v1/admin/appointments"
  });
  const bookingOptionsResponse = await server.inject({
    method: "GET",
    url: "/v1/admin/booking-options"
  });
  const dashboardResponse = await server.inject({
    method: "GET",
    url: "/v1/admin/dashboard"
  });
  const scheduleResponse = await server.inject({
    method: "GET",
    url: "/v1/admin/schedule"
  });
  const employeesResponse = await server.inject({
    method: "GET",
    url: "/v1/owner/employees"
  });

  assert.equal(loginResponse.statusCode, 503);
  assert.equal(clientsResponse.statusCode, 503);
  assert.equal(appointmentsResponse.statusCode, 503);
  assert.equal(bookingOptionsResponse.statusCode, 503);
  assert.equal(dashboardResponse.statusCode, 503);
  assert.equal(scheduleResponse.statusCode, 503);
  assert.equal(employeesResponse.statusCode, 503);
});

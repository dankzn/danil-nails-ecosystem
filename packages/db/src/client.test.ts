import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareDatabaseConnectionString } from "./client.js";

test("uses standard PostgreSQL semantics for required TLS", () => {
  const connectionString =
    "postgresql://prisma.project:secret@pooler.example.com:5432/postgres?sslmode=require";
  const prepared = new URL(
    prepareDatabaseConnectionString(connectionString)
  );

  assert.equal(prepared.searchParams.get("sslmode"), "require");
  assert.equal(prepared.searchParams.get("uselibpqcompat"), "true");
});

test("leaves other connection modes unchanged", () => {
  const connectionString =
    "postgresql://user:secret@localhost:5432/danil_nails";

  assert.equal(
    prepareDatabaseConnectionString(connectionString),
    connectionString
  );
});

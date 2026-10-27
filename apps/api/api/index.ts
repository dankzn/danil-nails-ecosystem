import type { IncomingMessage, ServerResponse } from "node:http";
import { createDatabaseClient } from "@danil-nails/db";
import { buildServer } from "../src/app.js";
import { environment } from "../src/config.js";

// Vercel keeps a warm serverless instance around between invocations, so
// this module-level singleton is reused across requests on the same
// instance — the Fastify app (and its Prisma client) is only built once
// per cold start, not once per request.
let serverPromise: ReturnType<typeof buildServer> | null = null;

function getServer() {
  if (!serverPromise) {
    const database = environment.DATABASE_URL
      ? createDatabaseClient(environment.DATABASE_URL)
      : null;
    serverPromise = buildServer(database, { logger: true }).then(async (server) => {
      await server.ready();
      return server;
    });
  }
  return serverPromise;
}

// Vercel's Node.js runtime invokes this default export with the raw
// req/res for every request path (see vercel.json's rewrite, which sends
// every path here). Emitting a "request" event on Fastify's underlying
// http.Server is the standard way to drive a full Fastify app from a
// foreign request handler without calling server.listen() — no per-route
// rewrite needed, the whole existing app.ts is reused as-is.
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const server = await getServer();
  server.server.emit("request", request, response);
}

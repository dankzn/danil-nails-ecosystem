import { setDefaultResultOrder } from "node:dns";
import { createDatabaseClient } from "@danil-nails/db";
import { buildServer } from "./app.js";
import { environment } from "./config.js";

// Some container platforms (Render included) advertise IPv6 connectivity that
// doesn't actually route, so Node's default "verbatim" DNS order can hand
// fetch() an IPv6 address it can never reach and surface that as a flat
// ENOTFOUND instead of falling back to IPv4 — this happened for real against
// Supabase's Storage API. Preferring IPv4 first sidesteps it.
setDefaultResultOrder("ipv4first");

const database = environment.DATABASE_URL
  ? createDatabaseClient(environment.DATABASE_URL)
  : null;
const server = await buildServer(database);

try {
  await server.listen({ port: environment.PORT, host: environment.HOST });
} catch (error) {
  server.log.error(error);
  await database?.$disconnect();
  process.exit(1);
}

async function shutdown(signal: string) {
  server.log.info({ signal }, "Shutting down");
  await server.close();
  await database?.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

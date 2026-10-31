import { createDatabaseClient } from "@danil-nails/db";
import { buildServer } from "./app.js";
import { environment } from "./config.js";
import { startNotifications } from "./notifications/index.js";

const database = environment.DATABASE_URL
  ? createDatabaseClient(environment.DATABASE_URL, {
      maxConnections: environment.DB_POOL_MAX,
      connectionTimeoutMs: environment.DB_CONNECTION_TIMEOUT_MS
    })
  : null;
const server = await buildServer(database);
// Telegram bot long-polling and the BullMQ notification dispatcher both need
// a real database connection — they stay off (no-op stop function) when
// DATABASE_URL isn't configured, same as the rest of the API in that mode.
const stopNotifications = database ? await startNotifications(database) : async () => {};

try {
  await server.listen({ port: environment.PORT, host: environment.HOST });
} catch (error) {
  server.log.error(error);
  await stopNotifications();
  await database?.$disconnect();
  process.exit(1);
}

async function shutdown(signal: string) {
  server.log.info({ signal }, "Shutting down");
  await server.close();
  await stopNotifications();
  await database?.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

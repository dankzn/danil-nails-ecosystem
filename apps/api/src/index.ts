import { createDatabaseClient } from "@danil-nails/db";
import { buildServer } from "./app.js";
import { environment } from "./config.js";

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

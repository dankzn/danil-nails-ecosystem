import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/client/client.js";

export type DatabaseClientOptions = {
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
};

export function prepareDatabaseConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);

    if (
      url.searchParams.get("sslmode") === "require" &&
      !url.searchParams.has("uselibpqcompat")
    ) {
      url.searchParams.set("uselibpqcompat", "true");
      return url.toString();
    }
  } catch {
    return connectionString;
  }

  return connectionString;
}

export function createDatabaseClient(
  connectionString: string,
  options: DatabaseClientOptions = {}
) {
  const pool = new Pool({
    connectionString: prepareDatabaseConnectionString(connectionString),
    max: options.maxConnections ?? 5,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
    keepAlive: true,
    allowExitOnIdle: true
  });
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });

  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

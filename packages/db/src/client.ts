import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client/client.js";

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

export function createDatabaseClient(connectionString: string) {
  const adapter = new PrismaPg(
    prepareDatabaseConnectionString(connectionString)
  );

  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

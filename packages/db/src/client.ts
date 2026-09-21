import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client/client.js";

export function createDatabaseClient(connectionString: string) {
  const adapter = new PrismaPg(connectionString);

  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

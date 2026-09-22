import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")],
  quiet: true
});

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://danil_nails:danil_nails_password@localhost:5432/danil_nails?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: databaseUrl
  }
});

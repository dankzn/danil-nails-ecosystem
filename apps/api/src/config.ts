import { resolve } from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")],
  quiet: true
});

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  APP_PUBLIC_URL: z.url().default("http://localhost:3000"),
  CRM_STATIC_DIR: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("danil_nails_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30)
});

export const environment = environmentSchema.parse(process.env);

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
  // Third-party integration URLs stay loosely typed and are validated (with
  // new URL()) only where they're actually used. A malformed value here must
  // never crash the whole process at boot — SITE_PUBLIC_URL/SUPABASE_URL are
  // optional features, not the app's own required config, so a typo in one
  // should disable that feature, not take down the CRM and the API with it.
  SITE_PUBLIC_URL: z.string().trim().min(1).optional(),
  CRM_STATIC_DIR: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("danil_nails_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  SUPABASE_URL: z.string().trim().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
  SUPABASE_STAFF_PHOTOS_BUCKET: z.string().min(1).default("staff-photos")
});

const parsedEnvironment = environmentSchema.parse(process.env);

function validUrlOrUndefined(value: string | undefined, label: string) {
  if (!value) return undefined;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    console.error(
      `[config] ${label} is not a valid URL ("${value}") — ignoring it, the feature it enables stays off.`
    );
    return undefined;
  }
}

export const environment = {
  ...parsedEnvironment,
  SITE_PUBLIC_URL: validUrlOrUndefined(parsedEnvironment.SITE_PUBLIC_URL, "SITE_PUBLIC_URL"),
  SUPABASE_URL: validUrlOrUndefined(parsedEnvironment.SUPABASE_URL, "SUPABASE_URL")
};

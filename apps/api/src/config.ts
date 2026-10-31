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
  // never crash the whole process at boot — SITE_PUBLIC_URL is an optional
  // feature, not the app's own required config, so a typo in it should
  // disable that feature, not take down the CRM and the API with it.
  SITE_PUBLIC_URL: z.string().trim().min(1).optional(),
  // The CRM and API are separate Vercel projects, so the CRM origin must be
  // explicitly allowed by CORS.
  CRM_PUBLIC_URL: z.string().trim().min(1).optional(),
  CRM_STATIC_DIR: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
  API_SLOW_REQUEST_MS: z.coerce.number().int().min(100).max(30_000).default(750),
  SESSION_COOKIE_NAME: z.string().min(1).default("danil_nails_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  // All of the below are optional integrations, same philosophy as
  // SITE_PUBLIC_URL/CRM_PUBLIC_URL: absent or malformed must only disable the
  // feature (Telegram bot, WhatsApp sending, the notification dispatch
  // endpoint), never crash boot. WhatsApp is wired but intentionally left
  // unconfigured until a Spanish business phone number is registered with
  // the Cloud API.
  //
  // apps/api runs as a Vercel serverless function in production (see
  // api/index.ts) — there is no persistent process to run a long-polling
  // bot or a background worker, so Telegram uses a webhook
  // (TELEGRAM_WEBHOOK_SECRET validates it's really Telegram calling in) and
  // the notification queue is drained by an external scheduler hitting
  // POST /v1/internal/notifications/dispatch (NOTIFICATIONS_DISPATCH_SECRET
  // guards that endpoint — see .github/workflows/dispatch-notifications.yml).
  TELEGRAM_BOT_TOKEN: z.string().trim().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().trim().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().trim().min(1).optional(),
  NOTIFICATIONS_DISPATCH_SECRET: z.string().trim().min(1).optional()
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
  CRM_PUBLIC_URL: validUrlOrUndefined(parsedEnvironment.CRM_PUBLIC_URL, "CRM_PUBLIC_URL")
};

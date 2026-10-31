import { UserRole, type DatabaseClient } from "@danil-nails/db";
import type { FastifyInstance } from "fastify";
import { authorize } from "../auth/session.js";
import { environment } from "../config.js";
import {
  createTelegramWebhookHandler,
  dispatchDueNotificationJobs,
  registerTelegramWebhook
} from "../notifications/index.js";

export function isAuthorizedDispatchRequest(
  headerValue: string | string[] | undefined,
  secret: string | undefined
) {
  if (!secret) return false;
  return typeof headerValue === "string" && headerValue === secret;
}

export async function registerNotificationRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const ownerGuard = authorize(database, [UserRole.owner]);

  // Telegram calls this directly — registered once per cold start so
  // bot.init()'s one-time network call doesn't happen on every request.
  const telegramWebhookHandler = database
    ? await createTelegramWebhookHandler(database)
    : null;

  server.post("/v1/telegram/webhook", async (request, reply) => {
    if (!telegramWebhookHandler) {
      return reply.code(503).send({ error: "telegram_not_configured" });
    }
    // The grammY adapter calls reply.send()/reply.code() itself — nothing
    // further to return here.
    await telegramWebhookHandler(request, reply);
  });

  // Pinged by an external scheduler (see
  // .github/workflows/dispatch-notifications.yml) every few minutes —
  // apps/api has no persistent process of its own to run this on a timer.
  server.post(
    "/v1/internal/notifications/dispatch",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!database) {
        return reply.code(503).send({ error: "database_not_configured" });
      }
      if (
        !isAuthorizedDispatchRequest(
          request.headers["x-dispatch-secret"],
          environment.NOTIFICATIONS_DISPATCH_SECRET
        )
      ) {
        return reply.code(401).send({ error: "invalid_dispatch_secret" });
      }

      const processed = await dispatchDueNotificationJobs(database);
      return { processed };
    }
  );

  // One-off setup call an owner makes after deploying with
  // TELEGRAM_BOT_TOKEN/APP_PUBLIC_URL/TELEGRAM_WEBHOOK_SECRET configured —
  // tells Telegram where to deliver updates. Safe to re-run any time.
  server.post(
    "/v1/admin/telegram/webhook/register",
    { preHandler: ownerGuard },
    async (_request, reply) => {
      const result = await registerTelegramWebhook(database!);
      if (!result.ok) {
        return reply.code(400).send(result);
      }
      return result;
    }
  );
}

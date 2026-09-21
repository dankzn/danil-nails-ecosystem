import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { DatabaseClient } from "@danil-nails/db";
import {
  appointmentStatuses,
  attendanceConfirmationStatuses,
  bookingRules,
  businessConfig,
  supportedCurrencies,
  supportedLocales,
  userRoles
} from "@danil-nails/shared";
import Fastify from "fastify";
import { environment } from "./config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerClientRoutes } from "./routes/clients.js";
import { registerServiceRoutes } from "./routes/services.js";

export async function buildServer(
  database: DatabaseClient | null,
  options: { logger?: boolean } = {}
) {
  const server = Fastify({ logger: options.logger ?? true });

  server.decorateRequest("crmUser", null);

  await server.register(cookie);
  await server.register(cors, {
    origin: environment.APP_PUBLIC_URL,
    credentials: true
  });
  await server.register(rateLimit, {
    global: false
  });

  server.get("/health", async () => ({
    ok: true,
    service: "danil-nails-api",
    database: database ? "configured" : "not_configured"
  }));

  server.get("/ready", async (_request, reply) => {
    if (!database) {
      return reply.code(503).send({ ok: false, database: "not_configured" });
    }

    await database.$queryRaw`SELECT 1`;
    return { ok: true, database: "connected" };
  });

  server.get("/v1/meta", async () => ({
    brand: businessConfig.brandName,
    timezone: businessConfig.timezone,
    locales: supportedLocales,
    currencies: supportedCurrencies,
    roles: userRoles,
    appointmentStatuses,
    attendanceConfirmationStatuses
  }));

  server.get("/v1/requirements", async () => ({
    launchMode: "owner_closed_test",
    bookingModeration: "manual_admin_confirmation",
    attendanceConfirmation: "separate_from_appointment_status",
    bookingRules,
    privateClientTagsMustNeverReachClientApi: true
  }));

  registerAuthRoutes(server, database);
  registerServiceRoutes(server, database);
  registerClientRoutes(server, database);

  return server;
}

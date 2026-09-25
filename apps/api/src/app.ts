import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
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
import { resolve } from "node:path";
import { environment } from "./config.js";
import { registerAvailabilityRoutes } from "./routes/availability.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAppointmentRoutes } from "./routes/appointments.js";
import { registerClientRoutes } from "./routes/clients.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerDirectoryRoutes } from "./routes/directories.js";
import { registerEmployeeRoutes } from "./routes/employees.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerOrgStructureRoutes } from "./routes/org-structure.js";
import { registerPayrollRoutes } from "./routes/payroll.js";
import { registerScheduleRoutes } from "./routes/schedule.js";
import { registerServiceRoutes } from "./routes/services.js";
import { registerWaitlistRoutes } from "./routes/waitlist.js";

export async function buildServer(
  database: DatabaseClient | null,
  options: { logger?: boolean } = {}
) {
  const server = Fastify({ logger: options.logger ?? true });

  server.decorateRequest("crmUser", null);

  await server.register(cookie);
  await server.register(cors, {
    origin: environment.APP_PUBLIC_URL,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  await server.register(rateLimit, {
    global: false
  });
  server.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-robots-tag", "noindex, nofollow, noarchive");
    return payload;
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
  registerAvailabilityRoutes(server, database);
  registerAppointmentRoutes(server, database);
  registerServiceRoutes(server, database);
  registerClientRoutes(server, database);
  registerDashboardRoutes(server, database);
  registerScheduleRoutes(server, database);
  registerEmployeeRoutes(server, database);
  registerPayrollRoutes(server, database);
  registerDirectoryRoutes(server, database);
  registerOrgStructureRoutes(server, database);
  registerInventoryRoutes(server, database);
  registerWaitlistRoutes(server, database);

  if (environment.NODE_ENV === "production") {
    await server.register(staticFiles, {
      root: resolve(
        environment.CRM_STATIC_DIR ?? resolve(process.cwd(), "apps/web/out")
      ),
      prefix: "/",
      redirect: true
    });
  }

  return server;
}

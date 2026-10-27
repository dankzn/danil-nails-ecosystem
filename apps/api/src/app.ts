import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import type { DatabaseClient, UserRole } from "@danil-nails/db";

// Kept here rather than in a separate ambient .d.ts file so it's always
// part of whatever compiles app.ts, rather than depending on that file
// being picked up by an "include" glob.
declare module "fastify" {
  interface FastifyRequest {
    crmUser: {
      id: string;
      email: string | null;
      phone: string | null;
      displayName: string | null;
      role: UserRole;
    } | null;
  }
}
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
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { environment } from "./config.js";
import { registerAvailabilityRoutes } from "./routes/availability.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAppointmentRoutes } from "./routes/appointments.js";
import { registerClientRoutes } from "./routes/clients.js";
import { registerClientProfileRoutes } from "./routes/client-profile.js";
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
  const allowedOrigins = new Set(
    [environment.APP_PUBLIC_URL, environment.SITE_PUBLIC_URL, environment.CRM_PUBLIC_URL].filter(
      (value): value is string => Boolean(value)
    )
  );

  await server.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      // Logged (not just rejected) so a misconfigured *_PUBLIC_URL shows up
      // directly in the deployment's logs instead of only as an opaque
      // browser-side CORS error with no indication of which origin or
      // which allowed list was involved.
      server.log.warn(
        { origin, allowedOrigins: [...allowedOrigins] },
        "Rejected cross-origin request: origin not in the allow-list"
      );
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  await server.register(rateLimit, {
    global: false
  });
  await server.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 }
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
  registerClientProfileRoutes(server, database);
  registerDashboardRoutes(server, database);
  registerScheduleRoutes(server, database);
  registerEmployeeRoutes(server, database);
  registerPayrollRoutes(server, database);
  registerDirectoryRoutes(server, database);
  registerOrgStructureRoutes(server, database);
  registerInventoryRoutes(server, database);
  registerWaitlistRoutes(server, database);

  // On Vercel the API runs as its own project/serverless function — the
  // CRM is deployed separately (its own Vercel static project, just like
  // apps/site) rather than served from this same process, so there's no
  // "apps/web/out" build alongside this one to serve here. Checking that
  // the directory actually exists (rather than trusting an env var like
  // process.env.VERCEL) is what actually keeps @fastify/static — and its
  // content-disposition dependency, which crashes when required in
  // Vercel's function runtime — out of that deployment entirely: the
  // import below only runs when there's really something to serve.
  if (environment.NODE_ENV === "production") {
    const staticDir = resolve(
      environment.CRM_STATIC_DIR ?? resolve(process.cwd(), "apps/web/out")
    );
    if (existsSync(staticDir)) {
      const { default: staticFiles } = await import("@fastify/static");
      await server.register(staticFiles, {
        root: staticDir,
        prefix: "/",
        redirect: true
      });
    }
  }

  return server;
}

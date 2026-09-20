import Fastify from "fastify";
import {
  appointmentStatuses,
  businessConfig,
  initialServices,
  supportedLocales,
  userRoles
} from "@danil-nails/shared";

const server = Fastify({
  logger: true
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

server.get("/health", async () => ({
  ok: true,
  service: "danil-nails-api"
}));

server.get("/v1/meta", async () => ({
  brand: businessConfig.brandName,
  timezone: businessConfig.timezone,
  locales: supportedLocales,
  roles: userRoles,
  appointmentStatuses
}));

server.get("/v1/services", async () => ({
  services: initialServices
}));

server.get("/v1/requirements", async () => ({
  launchMode: "owner_closed_test",
  bookingModeration: "manual_admin_confirmation",
  defaultReminderMinutesBeforeAppointment: 60,
  nextBookingRequiresPrepaymentAfterNoShow: true,
  privateClientTagsMustNeverReachClientApi: true
}));

try {
  await server.listen({ port, host });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}


import type { DatabaseClient } from "@danil-nails/db";
import { businessConfig } from "@danil-nails/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  findAvailableSlots,
  isDateWithinBookingHorizon
} from "../availability.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const availabilityQuerySchema = z.object({
  staffId: z.string().cuid(),
  serviceId: z.string().cuid(),
  date: z.string().regex(datePattern)
});

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_availability_query" });
}

export function registerAvailabilityRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  server.get("/v1/availability", async (request, reply) => {
    const query = availabilityQuerySchema.safeParse(request.query);
    if (!query.success) return sendInvalidPayload(reply);
    if (!database) {
      return reply.code(503).send({ error: "database_not_configured" });
    }

    if (!isDateWithinBookingHorizon(query.data.date)) {
      return sendInvalidPayload(reply);
    }

    const availability = await findAvailableSlots(database, query.data);
    if (!availability.ok) {
      return reply.code(404).send({ error: availability.error });
    }

    return {
      date: query.data.date,
      timezone: businessConfig.timezone,
      staff: availability.staff,
      service: availability.service,
      slots: availability.slots
    };
  });
}

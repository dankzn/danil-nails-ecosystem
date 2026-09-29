import { EmploymentStatus, type DatabaseClient } from "@danil-nails/db";
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

function experienceYearsSince(hiredAt: Date | null) {
  if (!hiredAt) return null;
  const years = (Date.now() - hiredAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.floor(years));
}

export function registerAvailabilityRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  server.get("/v1/staff", async () => {
    if (!database) return { staff: [] };

    const staff = await database.staffProfile.findMany({
      where: { isBookable: true, employmentStatus: { not: EmploymentStatus.dismissed } },
      select: {
        id: true,
        displayName: true,
        // "bio" is the internal HR note ("Служебная информация" in the
        // CRM) and must never reach this public response — only the
        // fields below, which the owner writes specifically for the site.
        philosophy: true,
        worksVideoUrl: true,
        hiredAt: true,
        photo: { select: { updatedAt: true } },
        positions: {
          orderBy: { order: "asc" },
          where: { position: { isInternal: false, isArchived: false } },
          select: {
            position: {
              select: {
                titleRu: true,
                titleEn: true,
                titleEs: true,
                titleFr: true,
                isMasterRole: true
              }
            }
          }
        }
      },
      orderBy: { displayName: "asc" }
    });

    return {
      staff: staff.map(({ photo, positions, hiredAt, ...member }) => ({
        ...member,
        photoUrl: photo ? `/v1/staff/${member.id}/photo?v=${photo.updatedAt.getTime()}` : null,
        experienceYears: experienceYearsSince(hiredAt),
        // Internal positions (e.g. "Основатель-внутр") are excluded by the
        // `where` above and never reach this response at all — every
        // remaining position is public and shown, in order.
        positions: positions.map((assignment) => assignment.position)
      }))
    };
  });

  server.get("/v1/staff/:id/photo", async (request, reply) => {
    const parameters = z.object({ id: z.string().cuid() }).safeParse(request.params);
    if (!parameters.success) return sendInvalidPayload(reply);
    if (!database) return reply.code(404).send({ error: "photo_not_found" });

    const photo = await database.staffPhoto.findUnique({
      where: { staffProfileId: parameters.data.id }
    });
    if (!photo) return reply.code(404).send({ error: "photo_not_found" });

    reply.header("cache-control", "public, max-age=31536000, immutable");
    return reply.type(photo.contentType).send(photo.data);
  });

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

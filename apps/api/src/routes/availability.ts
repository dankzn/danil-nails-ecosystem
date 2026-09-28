import { EmploymentStatus, UserRole, type DatabaseClient } from "@danil-nails/db";
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
  server.get("/v1/staff", async () => {
    if (!database) return { staff: [] };

    const staff = await database.staffProfile.findMany({
      where: { isBookable: true, employmentStatus: { not: EmploymentStatus.dismissed } },
      select: {
        id: true,
        displayName: true,
        bio: true,
        photo: { select: { updatedAt: true } },
        position: {
          select: { titleRu: true, titleEn: true, titleEs: true, titleFr: true }
        },
        user: { select: { role: true } }
      },
      orderBy: { displayName: "asc" }
    });

    // The studio's owner is the public "face" of the business on the site
    // (see app/[lang]/master), so they lead the list regardless of name —
    // alphabetical order alone let a test/newer staff member outrank them.
    const ordered = [...staff].sort((a, b) => {
      const aIsOwner = a.user.role === UserRole.owner ? 0 : 1;
      const bIsOwner = b.user.role === UserRole.owner ? 0 : 1;
      return aIsOwner - bIsOwner;
    });

    return {
      staff: ordered.map(({ photo, user: _user, ...member }) => ({
        ...member,
        photoUrl: photo ? `/v1/staff/${member.id}/photo?v=${photo.updatedAt.getTime()}` : null
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

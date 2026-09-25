import { UserRole, WaitlistStatus, type DatabaseClient } from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";

const idSchema = z.object({ id: z.string().cuid() });
const waitlistStatuses = ["waiting", "notified", "booked", "canceled"] as const;
const listQuerySchema = z.object({
  status: z.enum([...waitlistStatuses, "all"]).default("waiting")
});
const createSchema = z.object({
  clientId: z.string().cuid(),
  serviceId: z.string().cuid(),
  staffId: z.string().cuid().nullable().optional(),
  preferredFrom: z.iso.datetime(),
  preferredTo: z.iso.datetime(),
  note: z.string().trim().max(1000).nullable().optional()
});
const updateSchema = z.object({
  status: z.enum(waitlistStatuses)
});

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_waitlist_payload" });
}

function isForeignKeyConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  );
}

const waitlistInclude = {
  client: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      telegramUsername: true
    }
  },
  service: { select: { id: true, titleRu: true, durationMinutes: true } },
  staff: { select: { id: true, displayName: true } }
} as const;

export function registerWaitlistRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const adminGuard = authorize(database, [UserRole.owner, UserRole.admin]);

  server.get(
    "/v1/admin/waitlist",
    { preHandler: adminGuard },
    async (request, reply) => {
      const query = listQuerySchema.safeParse(request.query);
      if (!query.success) return sendInvalidPayload(reply);

      const entries = await database!.waitlistEntry.findMany({
        where:
          query.data.status === "all"
            ? {}
            : { status: WaitlistStatus[query.data.status] },
        include: waitlistInclude,
        orderBy: { preferredFrom: "asc" }
      });
      return { entries };
    }
  );

  server.post(
    "/v1/admin/waitlist",
    { preHandler: adminGuard },
    async (request, reply) => {
      const input = createSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      const preferredFrom = new Date(input.data.preferredFrom);
      const preferredTo = new Date(input.data.preferredTo);
      if (preferredTo <= preferredFrom) return sendInvalidPayload(reply);

      try {
        const entry = await database!.waitlistEntry.create({
          data: {
            clientId: input.data.clientId,
            serviceId: input.data.serviceId,
            staffId: input.data.staffId ?? null,
            preferredFrom,
            preferredTo,
            note: input.data.note ?? null,
            createdByUserId: request.crmUser!.id
          },
          include: waitlistInclude
        });
        return reply.code(201).send({ entry });
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          return reply.code(404).send({ error: "waitlist_reference_not_found" });
        }
        throw error;
      }
    }
  );

  server.patch(
    "/v1/admin/waitlist/:id",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = updateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const current = await database!.waitlistEntry.findUnique({
        where: { id: parameters.data.id }
      });
      if (!current) return reply.code(404).send({ error: "waitlist_entry_not_found" });

      const status = WaitlistStatus[input.data.status];
      const now = new Date();
      const entry = await database!.waitlistEntry.update({
        where: { id: current.id },
        data: {
          status,
          ...(status === WaitlistStatus.notified ? { notifiedAt: now } : {}),
          ...(status === WaitlistStatus.booked || status === WaitlistStatus.canceled
            ? { resolvedAt: now }
            : {})
        },
        include: waitlistInclude
      });
      return { entry };
    }
  );
}

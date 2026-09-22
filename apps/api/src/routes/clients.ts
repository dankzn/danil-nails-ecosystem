import { Prisma, UserRole, type DatabaseClient } from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";

const clientInputSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(30),
  email: z.email().nullable().optional(),
  telegramUsername: z.string().trim().max(80).nullable().optional(),
  whatsappPhone: z.string().trim().max(30).nullable().optional(),
  allergies: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  requiresPrepayment: z.boolean().default(false),
  prepaymentReason: z.string().trim().max(500).nullable().optional()
});

const clientUpdateSchema = clientInputSchema.partial();
const idSchema = z.object({ id: z.string().cuid() });
const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

function normalizeTelegramUsername(username: string | null | undefined) {
  if (!username) return username;
  return username.replace(/^@/, "").toLowerCase();
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_client_payload" });
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

const adminClientInclude = {
  loyaltyStatus: true,
  privateTagAssignments: {
    include: { tag: true }
  }
} as const;

export function registerClientRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const adminGuard = authorize(database, [UserRole.owner, UserRole.admin]);

  server.get(
    "/v1/admin/clients",
    { preHandler: adminGuard },
    async (request, reply) => {
      const query = listQuerySchema.safeParse(request.query);
      if (!query.success) return sendInvalidPayload(reply);

      const search = query.data.search;
      const clients = await database!.client.findMany({
        where: search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                {
                  telegramUsername: {
                    contains: search.replace(/^@/, ""),
                    mode: "insensitive"
                  }
                }
              ]
            }
          : {},
        include: {
          ...adminClientInclude,
          _count: { select: { appointments: true } },
          appointments: {
            select: { startsAt: true },
            orderBy: { startsAt: "desc" },
            take: 1
          }
        },
        orderBy: { updatedAt: "desc" },
        take: query.data.limit
      });

      return { clients };
    }
  );

  server.get(
    "/v1/admin/clients/:id",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);

      const client = await database!.client.findUnique({
        where: { id: parameters.data.id },
        include: {
          ...adminClientInclude,
          appointments: {
            include: { service: true, staff: true },
            orderBy: { startsAt: "desc" }
          },
          nailPhotos: { orderBy: { createdAt: "desc" } },
          visitMaterials: { orderBy: { createdAt: "desc" } },
          visitNotes: { orderBy: { createdAt: "desc" } }
        }
      });

      if (!client) return reply.code(404).send({ error: "client_not_found" });
      return { client };
    }
  );

  server.post(
    "/v1/admin/clients",
    { preHandler: adminGuard },
    async (request, reply) => {
      const input = clientInputSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      const guestStatus = await database!.clientLoyaltyStatus.findUnique({
        where: { code: "guest" }
      });

      try {
        const clientData = withoutUndefined({
          ...input.data,
          phone: normalizePhone(input.data.phone),
          telegramUsername: normalizeTelegramUsername(
            input.data.telegramUsername
          ),
          ...(guestStatus
            ? { loyaltyStatus: { connect: { id: guestStatus.id } } }
            : {})
        }) as Prisma.ClientCreateInput;

        const client = await database!.client.create({
          data: clientData,
          include: adminClientInclude
        });

        return reply.code(201).send({ client });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "client_phone_already_exists" });
        }
        throw error;
      }
    }
  );

  server.patch(
    "/v1/admin/clients/:id",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = clientUpdateSchema.safeParse(request.body);

      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const data = withoutUndefined({
        ...input.data,
        ...(input.data.phone
          ? { phone: normalizePhone(input.data.phone) }
          : undefined),
        ...(input.data.telegramUsername !== undefined
          ? {
              telegramUsername: normalizeTelegramUsername(
                input.data.telegramUsername
              )
            }
          : undefined)
      }) as Prisma.ClientUpdateInput;

      try {
        const client = await database!.client.update({
          where: { id: parameters.data.id },
          data,
          include: adminClientInclude
        });

        return { client };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "client_phone_already_exists" });
        }
        throw error;
      }
    }
  );
}

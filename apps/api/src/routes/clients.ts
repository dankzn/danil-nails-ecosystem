import {
  AppointmentStatus,
  LoyaltyTransactionType,
  Prisma,
  UserRole,
  type DatabaseClient
} from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";
import { categorizeClient, clientCategories, newClientWindow } from "../clients.js";

const clientInputSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(30),
  email: z.email().nullable().optional(),
  telegramUsername: z.string().trim().max(80).nullable().optional(),
  whatsappPhone: z.string().trim().max(30).nullable().optional(),
  allergies: z.string().trim().max(2000).nullable().optional(),
  allergens: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  privateTags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  requiresPrepayment: z.boolean().default(false),
  prepaymentReason: z.string().trim().max(500).nullable().optional(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  isBlocked: z.boolean().default(false)
});

const clientUpdateSchema = clientInputSchema.partial();
const idSchema = z.object({ id: z.string().cuid() });
const loyaltyAdjustmentSchema = z.object({
  direction: z.enum(["accrual", "redemption"]),
  points: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(1).max(500)
});
const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.enum(clientCategories).optional(),
  staffId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export function normalizeDictionaryTitles(titles: string[]) {
  const unique = new Map<string, string>();

  for (const value of titles) {
    const title = value.trim().replace(/\s+/g, " ");
    if (!title) continue;
    const key = title.toLocaleLowerCase("ru-RU");
    if (!unique.has(key)) unique.set(key, title);
  }

  return [...unique.values()];
}

export function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

function normalizeTelegramUsername(username: string | null | undefined) {
  if (!username) return username;
  return username.replace(/^@/, "").toLowerCase();
}

export function isUniqueConstraintError(error: unknown) {
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

type DictionaryDelegate = {
  findFirst(args: {
    where: { title: { equals: string; mode: "insensitive" } };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  create(args: {
    data: { title: string };
    select: { id: true };
  }): Promise<{ id: string }>;
};

async function resolveDictionaryIds(
  delegate: DictionaryDelegate,
  titles: string[]
) {
  const ids: string[] = [];

  for (const title of normalizeDictionaryTitles(titles)) {
    const where = { title: { equals: title, mode: "insensitive" as const } };
    const existing = await delegate.findFirst({ where, select: { id: true } });
    if (existing) {
      ids.push(existing.id);
      continue;
    }

    try {
      const created = await delegate.create({
        data: { title },
        select: { id: true }
      });
      ids.push(created.id);
    } catch (error) {
      // Another concurrent request created the same new title first.
      if (!isUniqueConstraintError(error)) throw error;
      const raceWinner = await delegate.findFirst({
        where,
        select: { id: true }
      });
      if (!raceWinner) throw error;
      ids.push(raceWinner.id);
    }
  }

  return ids;
}

function resolvePrivateTagIds(
  transaction: Prisma.TransactionClient,
  titles: string[]
) {
  return resolveDictionaryIds(transaction.clientPrivateTag, titles);
}

function resolveAllergenIds(
  transaction: Prisma.TransactionClient,
  titles: string[]
) {
  return resolveDictionaryIds(transaction.allergen, titles);
}

const adminClientInclude = {
  loyaltyStatus: true,
  privateTagAssignments: {
    include: { tag: true }
  },
  allergenAssignments: {
    include: { allergen: true }
  }
} as const;

export function registerClientRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const adminGuard = authorize(database, [UserRole.owner, UserRole.admin]);

  server.get(
    "/v1/admin/client-reference-data",
    { preHandler: adminGuard },
    async () => {
      const [storedTags, allergens] = await Promise.all([
        database!.clientPrivateTag.findMany({
          select: { title: true },
          orderBy: { title: "asc" }
        }),
        database!.allergen.findMany({
          select: { title: true, description: true },
          orderBy: { title: "asc" }
        })
      ]);
      const privateTags = normalizeDictionaryTitles(
        storedTags.map((tag) => tag.title)
      ).map((title) => ({ title }));

      return { privateTags, allergens };
    }
  );

  server.get(
    "/v1/admin/clients",
    { preHandler: adminGuard },
    async (request, reply) => {
      const query = listQuerySchema.safeParse(request.query);
      if (!query.success) return sendInvalidPayload(reply);

      const { search, category, staffId } = query.data;
      const now = new Date();
      const clients = await database!.client.findMany({
        where: {
          deletedAt: category === "deleted" ? { not: null } : null,
          ...(search
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
            : {})
        },
        include: {
          ...adminClientInclude,
          appointments: {
            select: {
              startsAt: true,
              status: true,
              staffId: true,
              payments: { where: { voidedAt: null }, select: { amountMinor: true } }
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      const withAggregates = clients.map(({ appointments, ...client }) => {
        const completedVisits = appointments.filter(
          (appointment) => appointment.status === AppointmentStatus.completed
        );
        const lastVisit = completedVisits.reduce<Date | null>(
          (latest, visit) =>
            !latest || visit.startsAt > latest ? visit.startsAt : latest,
          null
        );
        const totalSpentMinor = appointments.reduce(
          (sum, appointment) =>
            sum +
            appointment.payments.reduce((paid, payment) => paid + payment.amountMinor, 0),
          0
        );

        return {
          client,
          categories: categorizeClient({ ...client, appointments }, now),
          hasStaff: staffId
            ? appointments.some((appointment) => appointment.staffId === staffId)
            : true,
          summary: {
            visitCount: completedVisits.length,
            lastVisitAt: lastVisit,
            totalSpentMinor,
            averageCheckMinor:
              completedVisits.length > 0
                ? Math.round(totalSpentMinor / completedVisits.length)
                : 0
          }
        };
      });

      const filtered = withAggregates.filter(
        (entry) =>
          entry.hasStaff && (!category || entry.categories.has(category))
      );

      return {
        clients: filtered
          .slice(0, query.data.limit)
          .map(({ client, summary }) => ({ ...client, summary }))
      };
    }
  );

  server.get(
    "/v1/admin/clients/category-counts",
    { preHandler: adminGuard },
    async () => {
      const now = new Date();
      const clients = await database!.client.findMany({
        select: {
          id: true,
          createdAt: true,
          isBlocked: true,
          deletedAt: true,
          appointments: { select: { startsAt: true, status: true } }
        }
      });

      const counts: Record<(typeof clientCategories)[number], number> = {
        regular: 0,
        sleeping: 0,
        lost: 0,
        never_visited: 0,
        new: 0,
        blocked: 0,
        deleted: 0,
        penalized: 0
      };

      for (const client of clients) {
        for (const category of categorizeClient(client, now)) {
          counts[category] += 1;
        }
      }

      return { counts, newClientWindow: newClientWindow(now) };
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
        const {
          privateTags = [],
          allergens = [],
          ...clientFields
        } = input.data;
        const client = await database!.$transaction(async (transaction) => {
          const tagIds = await resolvePrivateTagIds(transaction, privateTags);
          const allergenIds = await resolveAllergenIds(transaction, allergens);
          const clientData = withoutUndefined({
            ...clientFields,
            phone: normalizePhone(clientFields.phone),
            telegramUsername: normalizeTelegramUsername(
              clientFields.telegramUsername
            ),
            ...(guestStatus
              ? { loyaltyStatus: { connect: { id: guestStatus.id } } }
              : {}),
            ...(tagIds.length
              ? {
                  privateTagAssignments: {
                    create: tagIds.map((tagId) => ({ tagId }))
                  }
                }
              : {}),
            ...(allergenIds.length
              ? {
                  allergenAssignments: {
                    create: allergenIds.map((allergenId) => ({ allergenId }))
                  }
                }
              : {})
          }) as Prisma.ClientCreateInput;

          return transaction.client.create({
            data: clientData,
            include: adminClientInclude
          });
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

      try {
        const { privateTags, allergens, ...clientFields } = input.data;
        const client = await database!.$transaction(async (transaction) => {
          const tagIds =
            privateTags === undefined
              ? undefined
              : await resolvePrivateTagIds(transaction, privateTags);
          const allergenIds =
            allergens === undefined
              ? undefined
              : await resolveAllergenIds(transaction, allergens);
          const data = withoutUndefined({
            ...clientFields,
            ...(clientFields.phone
              ? { phone: normalizePhone(clientFields.phone) }
              : undefined),
            ...(clientFields.telegramUsername !== undefined
              ? {
                  telegramUsername: normalizeTelegramUsername(
                    clientFields.telegramUsername
                  )
                }
              : undefined),
            ...(tagIds !== undefined
              ? {
                  privateTagAssignments: {
                    deleteMany: {},
                    create: tagIds.map((tagId) => ({ tagId }))
                  }
                }
              : {}),
            ...(allergenIds !== undefined
              ? {
                  allergenAssignments: {
                    deleteMany: {},
                    create: allergenIds.map((allergenId) => ({ allergenId }))
                  },
                  ...(allergenIds.length ? { noKnownAllergies: false } : {})
                }
              : {})
          }) as Prisma.ClientUpdateInput;

          return transaction.client.update({
            where: { id: parameters.data.id },
            data,
            include: adminClientInclude
          });
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

  server.get(
    "/v1/admin/clients/:id/loyalty-transactions",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);

      const client = await database!.client.findUnique({
        where: { id: parameters.data.id },
        select: { id: true }
      });
      if (!client) return reply.code(404).send({ error: "client_not_found" });

      const [transactions, balance] = await Promise.all([
        database!.clientLoyaltyTransaction.findMany({
          where: { clientId: parameters.data.id },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            type: true,
            pointsDelta: true,
            reason: true,
            createdAt: true,
            appointmentId: true,
            createdBy: {
              select: { staffProfile: { select: { displayName: true } } }
            }
          }
        }),
        database!.clientLoyaltyTransaction.aggregate({
          where: { clientId: parameters.data.id },
          _sum: { pointsDelta: true }
        })
      ]);

      return {
        balancePoints: balance._sum.pointsDelta ?? 0,
        transactions: transactions.map((transaction) => ({
          id: transaction.id,
          type: transaction.type,
          pointsDelta: transaction.pointsDelta,
          reason: transaction.reason,
          createdAt: transaction.createdAt,
          appointmentId: transaction.appointmentId,
          createdByDisplayName: transaction.createdBy?.staffProfile?.displayName ?? null
        }))
      };
    }
  );

  server.post(
    "/v1/admin/clients/:id/loyalty-transactions",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = loyaltyAdjustmentSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const client = await database!.client.findUnique({
        where: { id: parameters.data.id },
        select: { id: true }
      });
      if (!client) return reply.code(404).send({ error: "client_not_found" });

      const transaction = await database!.clientLoyaltyTransaction.create({
        data: {
          clientId: parameters.data.id,
          createdByUserId: request.crmUser!.id,
          type: LoyaltyTransactionType.adjustment,
          pointsDelta:
            input.data.direction === "accrual"
              ? input.data.points
              : -input.data.points,
          reason: input.data.reason
        }
      });

      return reply.code(201).send({ transaction });
    }
  );

  server.delete(
    "/v1/admin/clients/:id",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);

      const client = await database!.client.findUnique({
        where: { id: parameters.data.id },
        select: { id: true, deletedAt: true }
      });
      if (!client) return reply.code(404).send({ error: "client_not_found" });
      if (client.deletedAt) return reply.code(204).send();

      await database!.client.update({
        where: { id: parameters.data.id },
        data: { deletedAt: new Date() }
      });

      return reply.code(204).send();
    }
  );

  server.post(
    "/v1/admin/clients/:id/restore",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);

      const client = await database!.client.findUnique({
        where: { id: parameters.data.id },
        select: { id: true }
      });
      if (!client) return reply.code(404).send({ error: "client_not_found" });

      const restored = await database!.client.update({
        where: { id: parameters.data.id },
        data: { deletedAt: null },
        include: adminClientInclude
      });

      return { client: restored };
    }
  );
}

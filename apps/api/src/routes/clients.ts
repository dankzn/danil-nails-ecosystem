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
  allergens: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  privateTags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  requiresPrepayment: z.boolean().default(false),
  prepaymentReason: z.string().trim().max(500).nullable().optional()
});

const clientUpdateSchema = clientInputSchema.partial();
const idSchema = z.object({ id: z.string().cuid() });
const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const defaultPrivateTagTitles = [
  "скандальный",
  "требовательный",
  "доебистый",
  "лапочка"
];

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
      const privateTags = normalizeDictionaryTitles([
        ...defaultPrivateTagTitles,
        ...storedTags.map((tag) => tag.title)
      ]).map((title) => ({ title }));

      return { privateTags, allergens };
    }
  );

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
                  }
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
}

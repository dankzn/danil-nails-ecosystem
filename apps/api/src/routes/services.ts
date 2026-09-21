import {
  Currency,
  Prisma,
  UserRole,
  type DatabaseClient
} from "@danil-nails/db";
import { initialServices } from "@danil-nails/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";

const pricesSchema = z.object({
  RUB: z.number().int().nonnegative(),
  EUR: z.number().int().nonnegative(),
  USD: z.number().int().nonnegative()
});

const serviceInputSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  titleRu: z.string().trim().min(2).max(120),
  titleEn: z.string().trim().max(120).nullable().optional(),
  titleEs: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  durationMinutes: z.number().int().min(15).max(720),
  bufferAfterMinutes: z.number().int().min(0).max(240).default(0),
  isActive: z.boolean().default(true),
  prices: pricesSchema
});

const serviceUpdateSchema = serviceInputSchema.partial();
const idSchema = z.object({ id: z.string().cuid() });

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_service_payload" });
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

export function registerServiceRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  server.get("/v1/services", async () => {
    if (!database) {
      return { source: "mock", services: initialServices };
    }

    const services = await database.service.findMany({
      where: { isActive: true },
      include: { prices: { orderBy: { currency: "asc" } } },
      orderBy: { titleRu: "asc" }
    });

    return { source: "database", services };
  });

  const adminGuard = authorize(database, [UserRole.owner, UserRole.admin]);

  server.get(
    "/v1/admin/services",
    { preHandler: adminGuard },
    async () => ({
      services: await database!.service.findMany({
        include: { prices: { orderBy: { currency: "asc" } } },
        orderBy: { titleRu: "asc" }
      })
    })
  );

  server.post(
    "/v1/admin/services",
    { preHandler: adminGuard },
    async (request, reply) => {
      const input = serviceInputSchema.safeParse(request.body);

      if (!input.success) return sendInvalidPayload(reply);

      try {
        const { prices, ...serviceData } = input.data;
        const service = await database!.service.create({
          data: {
            ...(withoutUndefined(serviceData) as Prisma.ServiceCreateInput),
            prices: {
              create: Object.entries(prices).map(([currency, amountMinor]) => ({
                currency: Currency[currency as keyof typeof Currency],
                amountMinor
              }))
            }
          },
          include: { prices: true }
        });

        return reply.code(201).send({ service });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "service_slug_already_exists" });
        }
        throw error;
      }
    }
  );

  server.patch(
    "/v1/admin/services/:id",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = serviceUpdateSchema.safeParse(request.body);

      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const { prices, ...serviceData } = input.data;

      try {
        const service = await database!.$transaction(async (transaction) => {
          await transaction.service.update({
            where: { id: parameters.data.id },
            data: withoutUndefined(serviceData) as Prisma.ServiceUpdateInput
          });

          if (prices) {
            for (const [currency, amountMinor] of Object.entries(prices)) {
              if (amountMinor === undefined) continue;
              const parsedCurrency = Currency[currency as keyof typeof Currency];
              await transaction.servicePrice.upsert({
                where: {
                  serviceId_currency: {
                    serviceId: parameters.data.id,
                    currency: parsedCurrency
                  }
                },
                update: { amountMinor },
                create: {
                  serviceId: parameters.data.id,
                  currency: parsedCurrency,
                  amountMinor
                }
              });
            }
          }

          return transaction.service.findUniqueOrThrow({
            where: { id: parameters.data.id },
            include: { prices: true }
          });
        });

        return { service };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "service_slug_already_exists" });
        }
        throw error;
      }
    }
  );
}

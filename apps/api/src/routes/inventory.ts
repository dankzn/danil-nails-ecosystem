import {
  MaterialUnit,
  StockMovementType,
  UserRole,
  type DatabaseClient
} from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";

const materialUnits = ["piece", "ml", "g"] as const;
const manualMovementTypes = ["receipt", "adjustment", "write_off"] as const;

const idSchema = z.object({ id: z.string().cuid() });
const materialCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  sku: z.string().trim().max(60).nullable().optional(),
  unit: z.enum(materialUnits).default("piece"),
  reorderThreshold: z.number().nonnegative().default(0)
});
const materialUpdateSchema = materialCreateSchema.partial().extend({
  isArchived: z.boolean().optional()
});
const serviceLinksSchema = z.object({
  links: z
    .array(
      z.object({
        serviceId: z.string().cuid(),
        quantity: z.number().positive()
      })
    )
    .max(100)
});
const movementCreateSchema = z.object({
  type: z.enum(manualMovementTypes),
  quantity: z.number().positive(),
  note: z.string().trim().max(1000).nullable().optional()
});

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_inventory_payload" });
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function isForeignKeyConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  );
}

function movementSignedQuantity(type: (typeof manualMovementTypes)[number], quantity: number) {
  return type === "receipt" ? quantity : -quantity;
}

const materialInclude = {
  serviceLinks: {
    include: { service: { select: { id: true, titleRu: true } } }
  }
} as const;

export function registerInventoryRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const ownerGuard = authorize(database, [UserRole.owner]);

  server.get(
    "/v1/owner/materials",
    { preHandler: ownerGuard },
    async () => {
      const materials = await database!.material.findMany({
        include: materialInclude,
        orderBy: { title: "asc" }
      });
      const totals = await database!.stockMovement.groupBy({
        by: ["materialId"],
        _sum: { quantity: true }
      });
      const onHandByMaterial = new Map(
        totals.map((row) => [row.materialId, row._sum.quantity ?? 0])
      );

      return {
        materials: materials.map((material) => {
          const onHand = onHandByMaterial.get(material.id) ?? 0;
          return {
            ...material,
            onHand,
            isLow: onHand <= material.reorderThreshold
          };
        })
      };
    }
  );

  server.post(
    "/v1/owner/materials",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const input = materialCreateSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      try {
        const material = await database!.material.create({
          data: {
            title: input.data.title,
            sku: input.data.sku ?? null,
            unit: MaterialUnit[input.data.unit],
            reorderThreshold: input.data.reorderThreshold
          },
          include: materialInclude
        });
        return reply.code(201).send({ material: { ...material, onHand: 0, isLow: true } });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "material_already_exists" });
        }
        throw error;
      }
    }
  );

  server.patch(
    "/v1/owner/materials/:id",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = materialUpdateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      try {
        const material = await database!.material.update({
          where: { id: parameters.data.id },
          data: {
            ...(input.data.title !== undefined ? { title: input.data.title } : {}),
            ...(input.data.sku !== undefined ? { sku: input.data.sku } : {}),
            ...(input.data.unit !== undefined
              ? { unit: MaterialUnit[input.data.unit] }
              : {}),
            ...(input.data.reorderThreshold !== undefined
              ? { reorderThreshold: input.data.reorderThreshold }
              : {}),
            ...(input.data.isArchived !== undefined
              ? { isArchived: input.data.isArchived }
              : {})
          },
          include: materialInclude
        });
        const sum = await database!.stockMovement.aggregate({
          where: { materialId: material.id },
          _sum: { quantity: true }
        });
        const onHand = sum._sum.quantity ?? 0;
        return { material: { ...material, onHand, isLow: onHand <= material.reorderThreshold } };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "material_already_exists" });
        }
        throw error;
      }
    }
  );

  server.put(
    "/v1/owner/materials/:id/services",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = serviceLinksSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      try {
        const material = await database!.$transaction(async (transaction) => {
          await transaction.serviceMaterial.deleteMany({
            where: { materialId: parameters.data.id }
          });
          if (input.data.links.length) {
            await transaction.serviceMaterial.createMany({
              data: input.data.links.map((link) => ({
                materialId: parameters.data.id,
                serviceId: link.serviceId,
                quantity: link.quantity
              }))
            });
          }
          return transaction.material.findUniqueOrThrow({
            where: { id: parameters.data.id },
            include: materialInclude
          });
        });
        return { material };
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          return reply.code(404).send({ error: "service_not_found" });
        }
        throw error;
      }
    }
  );

  server.get(
    "/v1/owner/materials/:id/movements",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);

      const movements = await database!.stockMovement.findMany({
        where: { materialId: parameters.data.id },
        include: {
          actor: {
            select: {
              email: true,
              staffProfile: { select: { displayName: true } }
            }
          },
          appointment: {
            select: {
              id: true,
              client: { select: { fullName: true, phone: true } }
            }
          }
        },
        orderBy: { occurredAt: "desc" },
        take: 200
      });
      return { movements };
    }
  );

  server.post(
    "/v1/owner/materials/:id/movements",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = movementCreateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const material = await database!.material.findUnique({
        where: { id: parameters.data.id }
      });
      if (!material) return reply.code(404).send({ error: "material_not_found" });

      const movement = await database!.stockMovement.create({
        data: {
          materialId: material.id,
          type: StockMovementType[input.data.type],
          quantity: movementSignedQuantity(input.data.type, input.data.quantity),
          note: input.data.note ?? null,
          actorUserId: request.crmUser!.id
        }
      });
      return reply.code(201).send({ movement });
    }
  );
}

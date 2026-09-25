import { UserRole, type DatabaseClient } from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";

const idSchema = z.object({ id: z.string().cuid() });
const orgUnitCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  typeId: z.string().cuid(),
  parentId: z.string().cuid().nullable().optional(),
  organizationId: z.string().cuid(),
  cityId: z.string().cuid().nullable().optional(),
  countryId: z.string().cuid().nullable().optional(),
  effectiveFrom: z.iso.date().nullable().optional(),
  effectiveTo: z.iso.date().nullable().optional()
});
const orgUnitUpdateSchema = orgUnitCreateSchema.partial().extend({
  isArchived: z.boolean().optional()
});
const managerCreateSchema = z.object({
  staffId: z.string().cuid(),
  managerTypeId: z.string().cuid(),
  startsAt: z.iso.date().nullable().optional(),
  endsAt: z.iso.date().nullable().optional()
});
const managerUpdateSchema = z.object({
  endsAt: z.iso.date().nullable().optional()
});

const orgUnitInclude = {
  type: { select: { id: true, title: true } },
  organization: { select: { id: true, title: true } },
  city: { select: { id: true, title: true } },
  country: { select: { id: true, title: true } },
  managers: {
    where: { endsAt: null },
    include: {
      staff: { select: { id: true, displayName: true } },
      managerType: { select: { id: true, title: true } }
    }
  }
} as const;

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_org_unit_payload" });
}

function dateValue(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value}T12:00:00.000Z`);
}

function isForeignKeyConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  );
}

async function wouldCreateCycle(
  database: DatabaseClient,
  unitId: string,
  candidateParentId: string
) {
  let currentId: string | null = candidateParentId;
  const seen = new Set<string>();

  while (currentId) {
    if (currentId === unitId) return true;
    if (seen.has(currentId)) return true;
    seen.add(currentId);
    const parent: { parentId: string | null } | null =
      await database.orgUnit.findUnique({
        where: { id: currentId },
        select: { parentId: true }
      });
    currentId = parent?.parentId ?? null;
  }

  return false;
}

export function registerOrgStructureRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const ownerGuard = authorize(database, [UserRole.owner]);

  server.get(
    "/v1/owner/org-units",
    { preHandler: ownerGuard },
    async () => {
      const orgUnits = await database!.orgUnit.findMany({
        include: orgUnitInclude,
        orderBy: { title: "asc" }
      });
      return { orgUnits };
    }
  );

  server.post(
    "/v1/owner/org-units",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const input = orgUnitCreateSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      try {
        const orgUnit = await database!.orgUnit.create({
          data: {
            title: input.data.title,
            typeId: input.data.typeId,
            organizationId: input.data.organizationId,
            parentId: input.data.parentId ?? null,
            cityId: input.data.cityId ?? null,
            countryId: input.data.countryId ?? null,
            effectiveFrom: dateValue(input.data.effectiveFrom),
            effectiveTo: dateValue(input.data.effectiveTo)
          },
          include: orgUnitInclude
        });
        return reply.code(201).send({ orgUnit });
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          return reply.code(404).send({ error: "org_unit_reference_not_found" });
        }
        throw error;
      }
    }
  );

  server.patch(
    "/v1/owner/org-units/:id",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = orgUnitUpdateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const current = await database!.orgUnit.findUnique({
        where: { id: parameters.data.id }
      });
      if (!current) return reply.code(404).send({ error: "org_unit_not_found" });

      if (input.data.parentId) {
        if (
          await wouldCreateCycle(database!, current.id, input.data.parentId)
        ) {
          return reply.code(409).send({ error: "org_unit_cycle" });
        }
      }

      try {
        const orgUnit = await database!.orgUnit.update({
          where: { id: current.id },
          data: {
            ...(input.data.title !== undefined ? { title: input.data.title } : {}),
            ...(input.data.typeId !== undefined
              ? { typeId: input.data.typeId }
              : {}),
            ...(input.data.organizationId !== undefined
              ? { organizationId: input.data.organizationId }
              : {}),
            ...(input.data.parentId !== undefined
              ? { parentId: input.data.parentId }
              : {}),
            ...(input.data.cityId !== undefined
              ? { cityId: input.data.cityId }
              : {}),
            ...(input.data.countryId !== undefined
              ? { countryId: input.data.countryId }
              : {}),
            ...(input.data.effectiveFrom !== undefined
              ? { effectiveFrom: dateValue(input.data.effectiveFrom) }
              : {}),
            ...(input.data.effectiveTo !== undefined
              ? { effectiveTo: dateValue(input.data.effectiveTo) }
              : {}),
            ...(input.data.isArchived !== undefined
              ? { isArchived: input.data.isArchived }
              : {})
          },
          include: orgUnitInclude
        });
        return { orgUnit };
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          return reply.code(404).send({ error: "org_unit_reference_not_found" });
        }
        throw error;
      }
    }
  );

  server.get(
    "/v1/owner/org-units/:id/managers",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);

      const managers = await database!.orgUnitManager.findMany({
        where: { orgUnitId: parameters.data.id },
        include: {
          staff: { select: { id: true, displayName: true } },
          managerType: { select: { id: true, title: true } },
          orgUnit: { select: { id: true, title: true } }
        },
        orderBy: { startsAt: "desc" }
      });
      return { managers };
    }
  );

  server.post(
    "/v1/owner/org-units/:id/managers",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = managerCreateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      try {
        const manager = await database!.orgUnitManager.create({
          data: {
            orgUnitId: parameters.data.id,
            staffId: input.data.staffId,
            managerTypeId: input.data.managerTypeId,
            ...(input.data.startsAt
              ? { startsAt: dateValue(input.data.startsAt)! }
              : {}),
            endsAt: dateValue(input.data.endsAt)
          },
          include: {
            staff: { select: { id: true, displayName: true } },
            managerType: { select: { id: true, title: true } },
            orgUnit: { select: { id: true, title: true } }
          }
        });
        return reply.code(201).send({ manager });
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          return reply.code(404).send({ error: "org_unit_reference_not_found" });
        }
        throw error;
      }
    }
  );

  server.get(
    "/v1/owner/org-unit-managers",
    { preHandler: ownerGuard },
    async () => {
      const managers = await database!.orgUnitManager.findMany({
        where: { endsAt: null },
        include: {
          staff: { select: { id: true, displayName: true } },
          managerType: { select: { id: true, title: true } },
          orgUnit: {
            select: { id: true, title: true, type: { select: { title: true } } }
          }
        },
        orderBy: { startsAt: "desc" }
      });
      return { managers };
    }
  );

  server.patch(
    "/v1/owner/org-unit-managers/:id",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = managerUpdateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const current = await database!.orgUnitManager.findUnique({
        where: { id: parameters.data.id }
      });
      if (!current) return reply.code(404).send({ error: "manager_not_found" });

      const manager = await database!.orgUnitManager.update({
        where: { id: current.id },
        data: { endsAt: dateValue(input.data.endsAt) ?? new Date() },
        include: {
          staff: { select: { id: true, displayName: true } },
          managerType: { select: { id: true, title: true } },
          orgUnit: { select: { id: true, title: true } }
        }
      });
      return { manager };
    }
  );
}

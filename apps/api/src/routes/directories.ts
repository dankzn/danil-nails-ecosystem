import { UserRole, type DatabaseClient } from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";

const simpleKinds = [
  "positions",
  "countries",
  "organizations",
  "org-unit-types",
  "manager-types"
] as const;
type SimpleKind = (typeof simpleKinds)[number];

const delegateForKind = (database: DatabaseClient, kind: SimpleKind) => {
  switch (kind) {
    case "positions":
      return database.position;
    case "countries":
      return database.country;
    case "organizations":
      return database.organization;
    case "org-unit-types":
      return database.orgUnitType;
    case "manager-types":
      return database.managerType;
  }
};

const kindParamsSchema = z.object({ kind: z.enum(simpleKinds) });
const idParamsSchema = z.object({
  kind: z.enum(simpleKinds),
  id: z.string().cuid()
});
const createSchema = z.object({ title: z.string().trim().min(2).max(160) });
const updateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  isArchived: z.boolean().optional()
});
const cityCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  countryId: z.string().cuid()
});
const cityUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  countryId: z.string().cuid().optional(),
  isArchived: z.boolean().optional()
});
const cityIdParamsSchema = z.object({ id: z.string().cuid() });

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_directory_payload" });
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

export function registerDirectoryRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const ownerGuard = authorize(database, [UserRole.owner]);

  server.get(
    "/v1/owner/directories",
    { preHandler: ownerGuard },
    async () => {
      const [
        positions,
        countries,
        cities,
        organizations,
        orgUnitTypes,
        managerTypes
      ] = await Promise.all([
        database!.position.findMany({ orderBy: { title: "asc" } }),
        database!.country.findMany({ orderBy: { title: "asc" } }),
        database!.city.findMany({
          orderBy: { title: "asc" },
          include: { country: { select: { id: true, title: true } } }
        }),
        database!.organization.findMany({ orderBy: { title: "asc" } }),
        database!.orgUnitType.findMany({ orderBy: { title: "asc" } }),
        database!.managerType.findMany({ orderBy: { title: "asc" } })
      ]);

      return {
        positions,
        countries,
        cities,
        organizations,
        orgUnitTypes,
        managerTypes
      };
    }
  );

  server.post(
    "/v1/owner/directories/:kind",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = kindParamsSchema.safeParse(request.params);
      const input = createSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      try {
        const delegate = delegateForKind(database!, parameters.data.kind);
        const entry = await (delegate as { create: Function }).create({
          data: { title: input.data.title }
        });
        return reply.code(201).send({ entry });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "directory_entry_already_exists" });
        }
        throw error;
      }
    }
  );

  server.patch(
    "/v1/owner/directories/:kind/:id",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idParamsSchema.safeParse(request.params);
      const input = updateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      if (input.data.title === undefined && input.data.isArchived === undefined) {
        return sendInvalidPayload(reply);
      }

      try {
        const delegate = delegateForKind(database!, parameters.data.kind);
        const entry = await (delegate as { update: Function }).update({
          where: { id: parameters.data.id },
          data: {
            ...(input.data.title !== undefined ? { title: input.data.title } : {}),
            ...(input.data.isArchived !== undefined
              ? { isArchived: input.data.isArchived }
              : {})
          }
        });
        return { entry };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "directory_entry_already_exists" });
        }
        throw error;
      }
    }
  );

  server.post(
    "/v1/owner/directories/cities",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const input = cityCreateSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      try {
        const entry = await database!.city.create({
          data: { title: input.data.title, countryId: input.data.countryId },
          include: { country: { select: { id: true, title: true } } }
        });
        return reply.code(201).send({ entry });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "directory_entry_already_exists" });
        }
        if (isForeignKeyConstraintError(error)) {
          return reply.code(404).send({ error: "country_not_found" });
        }
        throw error;
      }
    }
  );

  server.patch(
    "/v1/owner/directories/cities/:id",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = cityIdParamsSchema.safeParse(request.params);
      const input = cityUpdateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);
      if (
        input.data.title === undefined &&
        input.data.countryId === undefined &&
        input.data.isArchived === undefined
      ) {
        return sendInvalidPayload(reply);
      }

      try {
        const entry = await database!.city.update({
          where: { id: parameters.data.id },
          data: {
            ...(input.data.title !== undefined ? { title: input.data.title } : {}),
            ...(input.data.countryId !== undefined
              ? { countryId: input.data.countryId }
              : {}),
            ...(input.data.isArchived !== undefined
              ? { isArchived: input.data.isArchived }
              : {})
          },
          include: { country: { select: { id: true, title: true } } }
        });
        return { entry };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "directory_entry_already_exists" });
        }
        if (isForeignKeyConstraintError(error)) {
          return reply.code(404).send({ error: "country_not_found" });
        }
        throw error;
      }
    }
  );
}

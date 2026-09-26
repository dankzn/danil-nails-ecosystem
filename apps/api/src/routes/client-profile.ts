import type { DatabaseClient } from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";

const updateAllergiesSchema = z.object({
  noKnownAllergies: z.boolean(),
  allergenIds: z.array(z.string().cuid()).max(30),
  customAllergyNote: z.string().trim().max(1000).nullable()
});

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_allergy_payload" });
}

export function registerClientProfileRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  server.get("/v1/allergens", async () => {
    if (!database) return { allergens: [] };

    const allergens = await database.allergen.findMany({
      select: { id: true, title: true, description: true },
      orderBy: { title: "asc" }
    });

    return { allergens };
  });

  const clientGuard = authorize(database);

  server.get(
    "/v1/me/allergies",
    { preHandler: clientGuard },
    async (request, reply) => {
      const client = await database!.client.findUnique({
        where: { userId: request.crmUser!.id },
        select: {
          noKnownAllergies: true,
          customAllergyNote: true,
          allergenAssignments: {
            select: {
              allergen: { select: { id: true, title: true, description: true } }
            }
          }
        }
      });

      if (!client) return reply.code(404).send({ error: "client_profile_required" });

      return {
        noKnownAllergies: client.noKnownAllergies,
        customAllergyNote: client.customAllergyNote,
        allergens: client.allergenAssignments.map((assignment) => assignment.allergen)
      };
    }
  );

  server.put(
    "/v1/me/allergies",
    { preHandler: clientGuard },
    async (request, reply) => {
      const input = updateAllergiesSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      const hasCustomNote = Boolean(input.data.customAllergyNote);
      if (
        input.data.noKnownAllergies &&
        (input.data.allergenIds.length > 0 || hasCustomNote)
      ) {
        return reply.code(400).send({ error: "allergy_state_conflict" });
      }

      const client = await database!.client.findUnique({
        where: { userId: request.crmUser!.id },
        select: { id: true }
      });

      if (!client) return reply.code(404).send({ error: "client_profile_required" });

      if (input.data.allergenIds.length) {
        const existingCount = await database!.allergen.count({
          where: { id: { in: input.data.allergenIds } }
        });
        if (existingCount !== input.data.allergenIds.length) {
          return sendInvalidPayload(reply);
        }
      }

      const updated = await database!.$transaction(async (transaction) => {
        await transaction.clientAllergenAssignment.deleteMany({
          where: { clientId: client.id }
        });

        return transaction.client.update({
          where: { id: client.id },
          data: {
            noKnownAllergies: input.data.noKnownAllergies,
            customAllergyNote: input.data.customAllergyNote,
            allergenAssignments: {
              create: input.data.allergenIds.map((allergenId) => ({ allergenId }))
            }
          },
          select: {
            noKnownAllergies: true,
            customAllergyNote: true,
            allergenAssignments: {
              select: {
                allergen: { select: { id: true, title: true, description: true } }
              }
            }
          }
        });
      });

      return {
        noKnownAllergies: updated.noKnownAllergies,
        customAllergyNote: updated.customAllergyNote,
        allergens: updated.allergenAssignments.map((assignment) => assignment.allergen)
      };
    }
  );
}

import { hashPassword, verifyPassword, type DatabaseClient } from "@danil-nails/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { environment } from "../config.js";
import { isUniqueConstraintError, normalizePhone } from "./clients.js";
import {
  authorize,
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  sessionExpiryDate,
  setSessionCookie
} from "../auth/session.js";

const loginSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(256)
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(30),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(256)
});

export function registerAuthRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  server.post(
    "/v1/auth/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      if (!database) {
        return reply.code(503).send({ error: "database_not_configured" });
      }

      const input = loginSchema.safeParse(request.body);

      if (!input.success) {
        return reply.code(400).send({ error: "invalid_login_payload" });
      }

      const user = await database.user.findUnique({
        where: { email: input.data.email },
        include: { staffProfile: true }
      });

      const passwordIsValid =
        user?.passwordHash &&
        (await verifyPassword(input.data.password, user.passwordHash));

      if (!user || !user.isActive || !passwordIsValid) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }

      const token = createSessionToken();
      const expiresAt = sessionExpiryDate();
      const userAgentHeader = request.headers["user-agent"];

      await database.$transaction([
        database.session.deleteMany({
          where: { expiresAt: { lte: new Date() } }
        }),
        database.session.create({
          data: {
            userId: user.id,
            tokenHash: hashSessionToken(token),
            expiresAt,
            ipAddress: request.ip,
            userAgent:
              typeof userAgentHeader === "string" ? userAgentHeader : null
          }
        }),
        database.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })
      ]);

      setSessionCookie(reply, token, expiresAt);

      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.staffProfile?.displayName ?? null,
          role: user.role
        }
      };
    }
  );

  server.post(
    "/v1/auth/register",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      if (!database) {
        return reply.code(503).send({ error: "database_not_configured" });
      }

      const input = registerSchema.safeParse(request.body);

      if (!input.success) {
        return reply.code(400).send({ error: "invalid_register_payload" });
      }

      const passwordHash = await hashPassword(input.data.password);
      const phone = normalizePhone(input.data.phone);
      const token = createSessionToken();
      const expiresAt = sessionExpiryDate();
      const userAgentHeader = request.headers["user-agent"];

      try {
        const user = await database.$transaction(async (transaction) => {
          const createdUser = await transaction.user.create({
            data: {
              role: "client",
              email: input.data.email,
              phone,
              passwordHash,
              client: {
                create: {
                  fullName: input.data.fullName,
                  phone,
                  email: input.data.email
                }
              }
            }
          });

          await transaction.session.create({
            data: {
              userId: createdUser.id,
              tokenHash: hashSessionToken(token),
              expiresAt,
              ipAddress: request.ip,
              userAgent:
                typeof userAgentHeader === "string" ? userAgentHeader : null
            }
          });

          return createdUser;
        });

        setSessionCookie(reply, token, expiresAt);

        return reply.code(201).send({
          user: {
            id: user.id,
            email: user.email,
            displayName: input.data.fullName,
            role: user.role
          }
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(409).send({ error: "account_already_exists" });
        }
        throw error;
      }
    }
  );

  server.get(
    "/v1/auth/me",
    { preHandler: authorize(database) },
    async (request) => ({ user: request.crmUser })
  );

  server.post("/v1/auth/logout", async (request, reply) => {
    const token = request.cookies[environment.SESSION_COOKIE_NAME];

    if (database && token) {
      await database.session.deleteMany({
        where: { tokenHash: hashSessionToken(token) }
      });
    }

    clearSessionCookie(reply);
    return reply.code(204).send();
  });
}

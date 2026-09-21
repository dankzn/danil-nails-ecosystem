import { verifyPassword, type DatabaseClient } from "@danil-nails/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { environment } from "../config.js";
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

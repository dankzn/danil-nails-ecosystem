import { createHash, randomBytes } from "node:crypto";
import type { DatabaseClient, UserRole } from "@danil-nails/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { environment } from "../config.js";

const sessionCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: environment.NODE_ENV === "production"
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + environment.SESSION_TTL_DAYS);
  return expiresAt;
}

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date
) {
  reply.setCookie(environment.SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions,
    expires: expiresAt
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(environment.SESSION_COOKIE_NAME, sessionCookieOptions);
}

export function authorize(
  database: DatabaseClient | null,
  allowedRoles?: readonly UserRole[]
) {
  return async function authorizationGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    if (!database) {
      return reply.code(503).send({
        error: "database_not_configured",
        message: "Database connection is not configured"
      });
    }

    const token = request.cookies[environment.SESSION_COOKIE_NAME];

    if (!token) {
      return reply.code(401).send({ error: "authentication_required" });
    }

    const session = await database.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { include: { staffProfile: true } } }
    });

    if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
      clearSessionCookie(reply);
      return reply.code(401).send({ error: "invalid_session" });
    }

    request.crmUser = {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.staffProfile?.displayName ?? null,
      role: session.user.role
    };

    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      return reply.code(403).send({ error: "insufficient_permissions" });
    }

    await database.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    });
  };
}

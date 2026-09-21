import type { UserRole } from "@danil-nails/db";

declare module "fastify" {
  interface FastifyRequest {
    crmUser: {
      id: string;
      email: string | null;
      displayName: string | null;
      role: UserRole;
    } | null;
  }
}

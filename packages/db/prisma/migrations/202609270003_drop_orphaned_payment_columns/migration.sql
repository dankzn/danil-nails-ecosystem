-- The live production Payment table (per information_schema.columns, read
-- directly via Supabase's SQL editor) has two columns that never appear in
-- any migration or in the current Prisma schema:
--   - "acceptedByUserId" text NOT NULL, no default — blocks every payment
--     insert with a not-null violation (confirmed from a live 500 on
--     POST /v1/admin/appointments/:id/close).
--   - "paidAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP — harmless
--     (Postgres fills it on its own) but equally not part of the intended
--     schema. Dropping it now for the same reason: it's dead weight that
--     will only cause more confusion on the next drift investigation.
-- The production database predates migrations being the source of truth
-- for it, hence orphans like this that no migration ever introduced.
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "acceptedByUserId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "paidAt";

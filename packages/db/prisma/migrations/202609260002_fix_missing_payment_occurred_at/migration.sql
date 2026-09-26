-- The production database is missing Payment.occurredAt even though
-- migration 202609250001_appointment_payments (which adds it) is recorded
-- as applied — a schema drift discovered via a live 500 on
-- GET /v1/admin/appointments (PrismaClientKnownRequestError P2022,
-- "column Payment.occurredAt does not exist"). Re-adding the same column
-- here, guarded with IF NOT EXISTS, is safe to run regardless of the
-- drift's exact cause and needs no manual migration-history surgery.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

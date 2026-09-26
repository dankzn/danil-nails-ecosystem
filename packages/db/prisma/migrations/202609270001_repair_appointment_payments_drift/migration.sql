-- Migration 202609250001_appointment_payments is recorded as applied, but
-- its ALTER TABLE statements never actually took effect on production
-- (confirmed by two separate live 500s: Payment.occurredAt missing, then
-- Payment.receivedByUserId missing). Since that ALTER TABLE ran as one
-- statement, Postgres would have applied all of it or none of it — so this
-- re-applies the whole thing, not just the columns we happened to hit so
-- far. Every step is written to be safe to run whether or not it already
-- took effect, since we can no longer trust what state production is in.

-- CreateEnum (guarded: CREATE TYPE has no IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('online_acquiring', 'cash', 'phone_transfer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "closedByUserId" TEXT;

-- AlterTable: drop the pre-redesign columns if they're still there
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "amount";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "clientId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "provider";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "updatedAt";

-- AlterTable: add the current columns. amountMinor/method get a
-- placeholder default here (unlike the original migration) purely so this
-- is safe to run if the table unexpectedly already has rows; the
-- application always supplies real values on every write going forward.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "amountMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "externalTransactionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "method" "PaymentMethod" NOT NULL DEFAULT 'cash';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receivedByUserId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ALTER COLUMN "appointmentId" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_appointmentId_idx" ON "Payment"("appointmentId");

-- AddForeignKey (each guarded: ADD CONSTRAINT has no IF NOT EXISTS)
DO $$ BEGIN
  ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

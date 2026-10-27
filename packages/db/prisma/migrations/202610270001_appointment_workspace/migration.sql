-- Expand payment channels used by the appointment workspace.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'bank_card';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'sbp';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'qr';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'bank_transfer';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'other';

-- A free-form explanation is mandatory in the API for the "other" method.
ALTER TABLE "Payment" ADD COLUMN "note" TEXT;

-- Preserve the author of every appointment event for the activity timeline.
CREATE INDEX "AppointmentEvent_appointmentId_createdAt_idx"
ON "AppointmentEvent"("appointmentId", "createdAt");

UPDATE "AppointmentEvent" AS event
SET "actorUserId" = NULL
WHERE event."actorUserId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS author
    WHERE author."id" = event."actorUserId"
  );

ALTER TABLE "AppointmentEvent"
ADD CONSTRAINT "AppointmentEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Loyalty is a ledger: corrections and reopening create opposite entries,
-- while the original operation remains in history.
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('accrual', 'redemption', 'adjustment', 'reversal');

CREATE TABLE "ClientLoyaltyTransaction" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "createdByUserId" TEXT,
  "type" "LoyaltyTransactionType" NOT NULL,
  "pointsDelta" INTEGER NOT NULL,
  "reason" TEXT,
  "reversesTransactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientLoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientLoyaltyTransaction_reversesTransactionId_key"
ON "ClientLoyaltyTransaction"("reversesTransactionId");

CREATE INDEX "ClientLoyaltyTransaction_clientId_createdAt_idx"
ON "ClientLoyaltyTransaction"("clientId", "createdAt");

CREATE INDEX "ClientLoyaltyTransaction_appointmentId_createdAt_idx"
ON "ClientLoyaltyTransaction"("appointmentId", "createdAt");

ALTER TABLE "ClientLoyaltyTransaction"
ADD CONSTRAINT "ClientLoyaltyTransaction_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientLoyaltyTransaction"
ADD CONSTRAINT "ClientLoyaltyTransaction_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientLoyaltyTransaction"
ADD CONSTRAINT "ClientLoyaltyTransaction_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientLoyaltyTransaction"
ADD CONSTRAINT "ClientLoyaltyTransaction_reversesTransactionId_fkey"
FOREIGN KEY ("reversesTransactionId") REFERENCES "ClientLoyaltyTransaction"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('online_acquiring', 'cash', 'phone_transfer');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('captured', 'refunded', 'voided');

-- AlterTable
ALTER TABLE "Appointment"
ADD COLUMN "closedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Payment"
RENAME COLUMN "amount" TO "amountMinor";

ALTER TABLE "Payment"
ADD COLUMN "acceptedByUserId" TEXT NOT NULL,
ADD COLUMN "method" "PaymentMethod" NOT NULL,
ADD COLUMN "externalTransactionId" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Payment"
ALTER COLUMN "appointmentId" SET NOT NULL,
ALTER COLUMN "clientId" SET NOT NULL,
ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus",
ALTER COLUMN "status" SET DEFAULT 'captured';

-- CreateIndex
CREATE INDEX "Appointment_closedByUserId_completedAt_idx"
ON "Appointment"("closedByUserId", "completedAt");

CREATE INDEX "Payment_appointmentId_paidAt_idx"
ON "Payment"("appointmentId", "paidAt");

CREATE INDEX "Payment_clientId_paidAt_idx"
ON "Payment"("clientId", "paidAt");

CREATE INDEX "Payment_acceptedByUserId_paidAt_idx"
ON "Payment"("acceptedByUserId", "paidAt");

CREATE INDEX "Payment_method_paidAt_idx"
ON "Payment"("method", "paidAt");

-- AddForeignKey
ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_closedByUserId_fkey"
FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_acceptedByUserId_fkey"
FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

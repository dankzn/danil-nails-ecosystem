/*
  Warnings:

  - You are about to drop the column `amount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Payment` table. All the data in the column will be lost.
  - Added the required column `amountMinor` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Made the column `appointmentId` on table `Payment` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('online_acquiring', 'cash', 'phone_transfer');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "closedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "amount",
DROP COLUMN "clientId",
DROP COLUMN "provider",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
ADD COLUMN     "amountMinor" INTEGER NOT NULL,
ADD COLUMN     "externalTransactionId" TEXT,
ADD COLUMN     "method" "PaymentMethod" NOT NULL,
ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "receivedByUserId" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ALTER COLUMN "appointmentId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Payment_appointmentId_idx" ON "Payment"("appointmentId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

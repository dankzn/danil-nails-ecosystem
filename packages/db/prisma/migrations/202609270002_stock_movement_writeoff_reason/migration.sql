-- CreateEnum
CREATE TYPE "StockWriteOffReason" AS ENUM ('defect', 'expired', 'damaged', 'lost', 'other');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "writeOffReason" "StockWriteOffReason";

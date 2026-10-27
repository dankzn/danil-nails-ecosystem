-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "customAllergyNote" TEXT,
ADD COLUMN     "noKnownAllergies" BOOLEAN NOT NULL DEFAULT false;

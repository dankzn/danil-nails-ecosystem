CREATE TYPE "EmploymentStatus" AS ENUM ('active', 'probation', 'leave', 'dismissed');
CREATE TYPE "EmploymentType" AS ENUM ('owner', 'full_time', 'part_time', 'contractor', 'intern');
CREATE TYPE "EmployeeNoteCategory" AS ENUM ('general', 'performance', 'recognition', 'incident', 'hr');
CREATE TYPE "TrainingStatus" AS ENUM ('planned', 'in_progress', 'completed', 'canceled');
CREATE TYPE "EmployeeDocumentType" AS ENUM ('employment_contract', 'nda', 'consent', 'medical_book', 'certificate', 'other');
CREATE TYPE "EmployeeEventType" AS ENUM ('hired', 'status_changed', 'leave_started', 'leave_ended', 'dismissed', 'rehired', 'role_changed', 'profile_updated');

ALTER TABLE "StaffProfile"
ADD COLUMN "legalName" TEXT,
ADD COLUMN "position" TEXT,
ADD COLUMN "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'full_time',
ADD COLUMN "hiredAt" TIMESTAMP(3),
ADD COLUMN "probationEndsAt" TIMESTAMP(3),
ADD COLUMN "dismissedAt" TIMESTAMP(3),
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "workPhone" TEXT,
ADD COLUMN "personalEmail" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "emergencyContactName" TEXT,
ADD COLUMN "emergencyContactPhone" TEXT;

UPDATE "StaffProfile" AS staff
SET
  "employmentType" = CASE WHEN users."role" = 'owner' THEN 'owner'::"EmploymentType" ELSE 'full_time'::"EmploymentType" END,
  "hiredAt" = staff."createdAt",
  "legalName" = staff."displayName"
FROM "User" AS users
WHERE users."id" = staff."userId";

CREATE TABLE "EmployeeNote" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "category" "EmployeeNoteCategory" NOT NULL DEFAULT 'general',
  "title" TEXT,
  "body" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeTraining" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "provider" TEXT,
  "status" "TrainingStatus" NOT NULL DEFAULT 'planned',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "costMinor" INTEGER,
  "currency" "Currency",
  "certificateUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeTraining_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeDocument" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "type" "EmployeeDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeEvent" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "type" "EmployeeEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "details" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeNote_staffId_createdAt_idx" ON "EmployeeNote"("staffId", "createdAt");
CREATE INDEX "EmployeeTraining_staffId_status_idx" ON "EmployeeTraining"("staffId", "status");
CREATE INDEX "EmployeeTraining_endsAt_idx" ON "EmployeeTraining"("endsAt");
CREATE INDEX "EmployeeDocument_staffId_type_idx" ON "EmployeeDocument"("staffId", "type");
CREATE INDEX "EmployeeDocument_expiresAt_idx" ON "EmployeeDocument"("expiresAt");
CREATE INDEX "EmployeeEvent_staffId_occurredAt_idx" ON "EmployeeEvent"("staffId", "occurredAt");

ALTER TABLE "EmployeeNote" ADD CONSTRAINT "EmployeeNote_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeNote" ADD CONSTRAINT "EmployeeNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeTraining" ADD CONSTRAINT "EmployeeTraining_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvent" ADD CONSTRAINT "EmployeeEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvent" ADD CONSTRAINT "EmployeeEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

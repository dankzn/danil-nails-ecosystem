-- Positions can be marked internal (never exposed to clients/the public site).
ALTER TABLE "Position" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- A staff member can now hold more than one position.
CREATE TABLE "StaffPosition" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPosition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffPosition_staffProfileId_positionId_key" ON "StaffPosition"("staffProfileId", "positionId");

ALTER TABLE "StaffPosition" ADD CONSTRAINT "StaffPosition_staffProfileId_fkey"
    FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffPosition" ADD CONSTRAINT "StaffPosition_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carry over each staff member's existing single position as their primary one.
INSERT INTO "StaffPosition" ("id", "staffProfileId", "positionId", "order", "createdAt")
SELECT gen_random_uuid()::text, "id", "positionId", 0, now()
FROM "StaffProfile"
WHERE "positionId" IS NOT NULL;

ALTER TABLE "StaffProfile" DROP CONSTRAINT "StaffProfile_positionId_fkey";
ALTER TABLE "StaffProfile" DROP COLUMN "positionId";

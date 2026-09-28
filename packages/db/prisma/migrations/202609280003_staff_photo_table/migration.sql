-- Photos are never stored as an external URL (Supabase Storage caused an
-- unreliable DNS dependency); store the bytes in Postgres instead, in their
-- own table so ordinary StaffProfile queries never pull them in.
ALTER TABLE "StaffProfile" DROP COLUMN "photoUrl";

CREATE TABLE "StaffPhoto" (
    "staffProfileId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPhoto_pkey" PRIMARY KEY ("staffProfileId")
);

ALTER TABLE "StaffPhoto" ADD CONSTRAINT "StaffPhoto_staffProfileId_fkey"
    FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

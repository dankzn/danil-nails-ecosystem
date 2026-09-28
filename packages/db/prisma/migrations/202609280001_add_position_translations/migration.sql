-- Rename Position.title to titleRu and add optional translations.
ALTER TABLE "Position" RENAME COLUMN "title" TO "titleRu";
ALTER TABLE "Position" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Position" ADD COLUMN "titleEs" TEXT;
ALTER TABLE "Position" ADD COLUMN "titleFr" TEXT;

ALTER INDEX "Position_title_key" RENAME TO "Position_titleRu_key";

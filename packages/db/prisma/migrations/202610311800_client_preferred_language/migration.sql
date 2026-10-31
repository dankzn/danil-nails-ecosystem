ALTER TYPE "Locale" ADD VALUE IF NOT EXISTS 'fr';

ALTER TABLE "Client" ADD COLUMN "preferredLanguage" "Locale" NOT NULL DEFAULT 'ru';

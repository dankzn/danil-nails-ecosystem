-- The previous migration defaulted isMasterRole to false. Only flip the
-- column default going forward, for positions created from here on — do
-- NOT backfill existing rows to true: as of this migration, production's
-- only existing positions are organizational titles (e.g. "Основатель",
-- "Сооснователь", "SMM-менеджер"), none of them an actual craft role, so a
-- blanket backfill would wrongly mark them all as masters again.
ALTER TABLE "Position" ALTER COLUMN "isMasterRole" SET DEFAULT true;

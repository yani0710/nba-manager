ALTER TABLE "Player"
ADD COLUMN IF NOT EXISTS "formTrendDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastFormSnapshot" INTEGER NOT NULL DEFAULT 70;

CREATE TABLE IF NOT EXISTS "PlayerTrainingPlan" (
  "id" TEXT NOT NULL,
  "saveId" INTEGER NOT NULL,
  "playerId" INTEGER NOT NULL,
  "focus" TEXT NOT NULL,
  "intensity" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerTrainingPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerTrainingPlan_saveId_playerId_key"
ON "PlayerTrainingPlan"("saveId", "playerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlayerTrainingPlan_saveId_fkey'
  ) THEN
    ALTER TABLE "PlayerTrainingPlan"
    ADD CONSTRAINT "PlayerTrainingPlan_saveId_fkey"
    FOREIGN KEY ("saveId")
    REFERENCES "Save"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlayerTrainingPlan_playerId_fkey'
  ) THEN
    ALTER TABLE "PlayerTrainingPlan"
    ADD CONSTRAINT "PlayerTrainingPlan_playerId_fkey"
    FOREIGN KEY ("playerId")
    REFERENCES "Player"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

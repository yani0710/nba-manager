-- Add per-player day plan JSON to persisted player training plans.
ALTER TABLE "PlayerTrainingPlan"
ADD COLUMN IF NOT EXISTS "dayPlan" JSONB;

-- Persist team training day-by-day plans in a dedicated table.
CREATE TABLE IF NOT EXISTS "TeamTrainingDayPlan" (
  "id" TEXT NOT NULL,
  "saveId" INTEGER NOT NULL,
  "dayOfWeek" TEXT NOT NULL,
  "intensity" TEXT NOT NULL,
  "focus" TEXT NOT NULL,
  "durationMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamTrainingDayPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamTrainingDayPlan_saveId_dayOfWeek_key"
ON "TeamTrainingDayPlan"("saveId", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "TeamTrainingDayPlan_saveId_idx"
ON "TeamTrainingDayPlan"("saveId");

ALTER TABLE "TeamTrainingDayPlan"
ADD CONSTRAINT "TeamTrainingDayPlan_saveId_fkey"
FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

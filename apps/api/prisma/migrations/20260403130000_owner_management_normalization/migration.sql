-- Soft-delete support for saves.
ALTER TABLE "Save"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Performance indexes requested.
CREATE INDEX IF NOT EXISTS "Game_saveId_status_gameDate_idx"
ON "Game"("saveId", "status", "gameDate");

CREATE INDEX IF NOT EXISTS "GameStat_gameId_teamId_playerId_idx"
ON "GameStat"("gameId", "teamId", "playerId");

CREATE INDEX IF NOT EXISTS "InboxMessage_saveId_createdAt_isRead_idx"
ON "InboxMessage"("saveId", "createdAt", "isRead");

-- Owner goals normalized table.
CREATE TABLE IF NOT EXISTS "OwnerGoal" (
  "id" SERIAL NOT NULL,
  "saveId" INTEGER NOT NULL,
  "season" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "targetNumber" DOUBLE PRECISION,
  "targetText" TEXT,
  "currentValue" DOUBLE PRECISION DEFAULT 0,
  "progress" DOUBLE PRECISION DEFAULT 0,
  "weight" DOUBLE PRECISION DEFAULT 0.25,
  "status" TEXT NOT NULL DEFAULT 'on_track',
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OwnerGoal_saveId_season_type_key"
ON "OwnerGoal"("saveId", "season", "type");

CREATE INDEX IF NOT EXISTS "OwnerGoal_saveId_season_status_idx"
ON "OwnerGoal"("saveId", "season", "status");

ALTER TABLE "OwnerGoal"
ADD CONSTRAINT "OwnerGoal_saveId_fkey"
FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Job security event log table.
CREATE TABLE IF NOT EXISTS "JobSecurityEvent" (
  "id" SERIAL NOT NULL,
  "saveId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "score" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobSecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobSecurityEvent_saveId_date_idx"
ON "JobSecurityEvent"("saveId", "date");

CREATE INDEX IF NOT EXISTS "JobSecurityEvent_saveId_source_createdAt_idx"
ON "JobSecurityEvent"("saveId", "source", "createdAt");

ALTER TABLE "JobSecurityEvent"
ADD CONSTRAINT "JobSecurityEvent_saveId_fkey"
FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seasonal manager career snapshots.
CREATE TABLE IF NOT EXISTS "ManagerCareerStat" (
  "id" SERIAL NOT NULL,
  "saveId" INTEGER NOT NULL,
  "season" TEXT NOT NULL,
  "yearsManaged" INTEGER NOT NULL DEFAULT 1,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "playoffAppearances" INTEGER NOT NULL DEFAULT 0,
  "championships" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerCareerStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ManagerCareerStat_saveId_season_key"
ON "ManagerCareerStat"("saveId", "season");

CREATE INDEX IF NOT EXISTS "ManagerCareerStat_saveId_season_createdAt_idx"
ON "ManagerCareerStat"("saveId", "season", "createdAt");

ALTER TABLE "ManagerCareerStat"
ADD CONSTRAINT "ManagerCareerStat_saveId_fkey"
FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manager awards/achievements.
CREATE TABLE IF NOT EXISTS "ManagerAward" (
  "id" SERIAL NOT NULL,
  "saveId" INTEGER NOT NULL,
  "season" TEXT NOT NULL,
  "awardType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ManagerAward_saveId_season_awardType_title_key"
ON "ManagerAward"("saveId", "season", "awardType", "title");

CREATE INDEX IF NOT EXISTS "ManagerAward_saveId_season_awardedAt_idx"
ON "ManagerAward"("saveId", "season", "awardedAt");

ALTER TABLE "ManagerAward"
ADD CONSTRAINT "ManagerAward_saveId_fkey"
FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Board reviews/checkpoints.
CREATE TABLE IF NOT EXISTS "BoardReview" (
  "id" SERIAL NOT NULL,
  "saveId" INTEGER NOT NULL,
  "season" TEXT NOT NULL,
  "week" INTEGER,
  "date" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "verdict" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BoardReview_saveId_season_date_idx"
ON "BoardReview"("saveId", "season", "date");

ALTER TABLE "BoardReview"
ADD CONSTRAINT "BoardReview_saveId_fkey"
FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Weekly standings snapshots.
CREATE TABLE IF NOT EXISTS "WeeklyStandingsSnapshot" (
  "id" SERIAL NOT NULL,
  "saveId" INTEGER NOT NULL,
  "season" TEXT NOT NULL,
  "week" INTEGER NOT NULL,
  "conference" TEXT NOT NULL,
  "teamId" INTEGER NOT NULL,
  "rank" INTEGER NOT NULL,
  "wins" INTEGER NOT NULL,
  "losses" INTEGER NOT NULL,
  "pct" DOUBLE PRECISION NOT NULL,
  "gb" DOUBLE PRECISION NOT NULL,
  "streak" TEXT NOT NULL,
  "l10" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyStandingsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyStandingsSnapshot_saveId_season_week_teamId_key"
ON "WeeklyStandingsSnapshot"("saveId", "season", "week", "teamId");

CREATE INDEX IF NOT EXISTS "WeeklyStandingsSnapshot_saveId_week_conference_idx"
ON "WeeklyStandingsSnapshot"("saveId", "week", "conference");

ALTER TABLE "WeeklyStandingsSnapshot"
ADD CONSTRAINT "WeeklyStandingsSnapshot_saveId_fkey"
FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyStandingsSnapshot"
ADD CONSTRAINT "WeeklyStandingsSnapshot_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Monthly team metrics snapshots.
CREATE TABLE IF NOT EXISTS "MonthlyTeamMetricsSnapshot" (
  "id" SERIAL NOT NULL,
  "saveId" INTEGER NOT NULL,
  "season" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "teamId" INTEGER NOT NULL,
  "payroll" INTEGER NOT NULL,
  "avgMorale" DOUBLE PRECISION NOT NULL,
  "offenseRating" DOUBLE PRECISION NOT NULL,
  "defenseRating" DOUBLE PRECISION NOT NULL,
  "form" DOUBLE PRECISION NOT NULL,
  "wins" INTEGER NOT NULL,
  "losses" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyTeamMetricsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyTeamMetricsSnapshot_saveId_season_monthKey_teamId_key"
ON "MonthlyTeamMetricsSnapshot"("saveId", "season", "monthKey", "teamId");

CREATE INDEX IF NOT EXISTS "MonthlyTeamMetricsSnapshot_saveId_season_monthKey_idx"
ON "MonthlyTeamMetricsSnapshot"("saveId", "season", "monthKey");

ALTER TABLE "MonthlyTeamMetricsSnapshot"
ADD CONSTRAINT "MonthlyTeamMetricsSnapshot_saveId_fkey"
FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyTeamMetricsSnapshot"
ADD CONSTRAINT "MonthlyTeamMetricsSnapshot_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

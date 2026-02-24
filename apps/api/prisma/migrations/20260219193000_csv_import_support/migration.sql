ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Player_externalRef_key" ON "Player"("externalRef");

CREATE TABLE IF NOT EXISTS "PlayerGameLog" (
  "id" SERIAL NOT NULL,
  "season" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "teamAbbr" TEXT NOT NULL,
  "oppAbbr" TEXT NOT NULL,
  "result" TEXT,
  "minutes" DOUBLE PRECISION,
  "fg" INTEGER,
  "fga" INTEGER,
  "fgPct" DOUBLE PRECISION,
  "threeP" INTEGER,
  "threePA" INTEGER,
  "threePPct" DOUBLE PRECISION,
  "ft" INTEGER,
  "fta" INTEGER,
  "ftPct" DOUBLE PRECISION,
  "orb" INTEGER,
  "drb" INTEGER,
  "trb" INTEGER,
  "ast" INTEGER,
  "stl" INTEGER,
  "blk" INTEGER,
  "tov" INTEGER,
  "pf" INTEGER,
  "pts" INTEGER,
  "gameScore" DOUBLE PRECISION,
  "playerId" INTEGER NOT NULL,
  CONSTRAINT "PlayerGameLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlayerGameLog_season_date_idx" ON "PlayerGameLog"("season", "date");
CREATE INDEX IF NOT EXISTS "PlayerGameLog_teamAbbr_idx" ON "PlayerGameLog"("teamAbbr");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlayerGameLog_playerId_fkey'
  ) THEN
    ALTER TABLE "PlayerGameLog"
    ADD CONSTRAINT "PlayerGameLog_playerId_fkey"
    FOREIGN KEY ("playerId")
    REFERENCES "Player"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

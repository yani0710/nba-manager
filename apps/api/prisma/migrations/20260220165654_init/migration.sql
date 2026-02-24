/*
  Warnings:

  - You are about to drop the column `fgPct` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `ftPct` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `gameScore` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `minutes` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `oppAbbr` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `season` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `teamAbbr` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `threeP` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `threePA` on the `PlayerGameLog` table. All the data in the column will be lost.
  - You are about to drop the column `threePPct` on the `PlayerGameLog` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[playerId]` on the table `Contract` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nbaPlayerId]` on the table `Player` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[playerId,date,teamCode]` on the table `PlayerGameLog` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nbaTeamId]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `oppCode` to the `PlayerGameLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamCode` to the `PlayerGameLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PlayerGameLog_season_date_idx";

-- DropIndex
DROP INDEX "PlayerGameLog_teamAbbr_idx";

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "averageAnnualValue" INTEGER,
ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "currentYearSalary" INTEGER,
ADD COLUMN     "guaranteedValue" BIGINT,
ADD COLUMN     "isTwoWay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optionType" TEXT,
ADD COLUMN     "teamId" INTEGER,
ADD COLUMN     "totalValue" BIGINT,
ADD COLUMN     "type" TEXT,
ALTER COLUMN "salary" DROP NOT NULL,
ALTER COLUMN "startYear" DROP NOT NULL,
ALTER COLUMN "endYear" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "saveId" INTEGER;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "astCareer" DOUBLE PRECISION,
ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "debutYear" INTEGER,
ADD COLUMN     "efgPct" DOUBLE PRECISION,
ADD COLUMN     "fg3Pct" DOUBLE PRECISION,
ADD COLUMN     "fgPct" DOUBLE PRECISION,
ADD COLUMN     "finalYear" INTEGER,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "ftPct" DOUBLE PRECISION,
ADD COLUMN     "gamesCareer" INTEGER,
ADD COLUMN     "hallOfFame" BOOLEAN,
ADD COLUMN     "handedness" TEXT,
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "nbaPlayerId" INTEGER,
ADD COLUMN     "overall" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "per" DOUBLE PRECISION,
ADD COLUMN     "potential" INTEGER NOT NULL DEFAULT 75,
ADD COLUMN     "primaryPosition" TEXT NOT NULL DEFAULT 'N/A',
ADD COLUMN     "ptsCareer" DOUBLE PRECISION,
ADD COLUMN     "school" TEXT,
ADD COLUMN     "secondaryPosition" TEXT,
ADD COLUMN     "trbCareer" DOUBLE PRECISION,
ADD COLUMN     "weightKg" INTEGER,
ADD COLUMN     "ws" DOUBLE PRECISION,
ALTER COLUMN "number" DROP NOT NULL,
ALTER COLUMN "salary" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlayerGameLog" DROP COLUMN "fgPct",
DROP COLUMN "ftPct",
DROP COLUMN "gameScore",
DROP COLUMN "minutes",
DROP COLUMN "oppAbbr",
DROP COLUMN "season",
DROP COLUMN "teamAbbr",
DROP COLUMN "threeP",
DROP COLUMN "threePA",
DROP COLUMN "threePPct",
ADD COLUMN     "gmSc" DOUBLE PRECISION,
ADD COLUMN     "mp" DOUBLE PRECISION,
ADD COLUMN     "oppCode" TEXT NOT NULL,
ADD COLUMN     "teamCode" TEXT NOT NULL,
ADD COLUMN     "tp" INTEGER,
ADD COLUMN     "tpa" INTEGER;

-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "coachAvatarId" TEXT,
ADD COLUMN     "coachName" TEXT,
ADD COLUMN     "coachProfileId" INTEGER,
ADD COLUMN     "currentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "managedTeamId" INTEGER,
ADD COLUMN     "season" TEXT NOT NULL DEFAULT '2025-26',
ADD COLUMN     "teamId" INTEGER,
ADD COLUMN     "userId" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "conference" TEXT,
ADD COLUMN     "division" TEXT,
ADD COLUMN     "logoKey" TEXT,
ADD COLUMN     "logoPath" TEXT,
ADD COLUMN     "nbaTeamId" INTEGER,
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "secondaryColor" TEXT;

-- CreateTable
CREATE TABLE "ContractYear" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "salary" INTEGER NOT NULL,
    "guaranteed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "displayName" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "reputation" INTEGER NOT NULL DEFAULT 50,
    "preferredStyle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" SERIAL NOT NULL,
    "saveId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeasonAdvanced" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "teamCode" TEXT NOT NULL,
    "pos" TEXT NOT NULL,
    "per" DOUBLE PRECISION,
    "tsPercent" DOUBLE PRECISION,
    "x3pAr" DOUBLE PRECISION,
    "fTr" DOUBLE PRECISION,
    "orbPercent" DOUBLE PRECISION,
    "drbPercent" DOUBLE PRECISION,
    "trbPercent" DOUBLE PRECISION,
    "astPercent" DOUBLE PRECISION,
    "stlPercent" DOUBLE PRECISION,
    "blkPercent" DOUBLE PRECISION,
    "tovPercent" DOUBLE PRECISION,
    "usgPercent" DOUBLE PRECISION,
    "ows" DOUBLE PRECISION,
    "dws" DOUBLE PRECISION,
    "ws" DOUBLE PRECISION,
    "ws48" DOUBLE PRECISION,
    "obpm" DOUBLE PRECISION,
    "dbpm" DOUBLE PRECISION,
    "bpm" DOUBLE PRECISION,
    "vorp" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSeasonAdvanced_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractYear_contractId_season_key" ON "ContractYear"("contractId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "InboxMessage_saveId_date_idx" ON "InboxMessage"("saveId", "date");

-- CreateIndex
CREATE INDEX "PlayerSeasonAdvanced_season_teamCode_idx" ON "PlayerSeasonAdvanced"("season", "teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonAdvanced_playerId_season_key" ON "PlayerSeasonAdvanced"("playerId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_playerId_key" ON "Contract"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_nbaPlayerId_key" ON "Player"("nbaPlayerId");

-- CreateIndex
CREATE INDEX "PlayerGameLog_date_teamCode_idx" ON "PlayerGameLog"("date", "teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameLog_playerId_date_teamCode_key" ON "PlayerGameLog"("playerId", "date", "teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "Team_nbaTeamId_key" ON "Team"("nbaTeamId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractYear" ADD CONSTRAINT "ContractYear_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Save" ADD CONSTRAINT "Save_coachProfileId_fkey" FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Save" ADD CONSTRAINT "Save_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Save" ADD CONSTRAINT "Save_managedTeamId_fkey" FOREIGN KEY ("managedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Save" ADD CONSTRAINT "Save_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachProfile" ADD CONSTRAINT "CoachProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonAdvanced" ADD CONSTRAINT "PlayerSeasonAdvanced_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Player_teamId_number_key" RENAME TO "team_number_unique";

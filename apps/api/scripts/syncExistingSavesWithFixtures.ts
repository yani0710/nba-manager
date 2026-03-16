import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { loadFixturesFromCsv } from "../src/modules/fixtures/fixtureCsvLoader";
import { getGameweekForDate } from "../src/modules/fixtures/gameweekCalendar";
import { COMPLETED_GAME_STATUSES } from "../src/modules/fixtures/fixtureStatus";

const prisma = new PrismaClient();
const ET_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function gameDateEtKey(value: Date): string {
  return ET_KEY_FORMATTER.format(value);
}

function fixtureKey(params: { homeTeamId: number; awayTeamId: number; gameDate: Date }): string {
  return `${gameDateEtKey(params.gameDate)}|${params.homeTeamId}|${params.awayTeamId}`;
}

async function main() {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true, shortName: true },
    orderBy: { id: "asc" },
  });
  if (teams.length < 30) {
    throw new Error("Teams are not seeded. Run seed first.");
  }

  const saves = await prisma.save.findMany({
    select: { id: true, season: true, currentDate: true, data: true },
    orderBy: { id: "asc" },
  });

  const fixturesBySeason = new Map<string, ReturnType<typeof loadFixturesFromCsv>>();
  let updatedSaves = 0;

  for (const save of saves) {
    const payload = ((save.data ?? {}) as Record<string, unknown>) ?? {};
    const season = String(payload.season ?? save.season ?? "2025-26");

    let loaded = fixturesBySeason.get(season);
    if (!loaded) {
      loaded = loadFixturesFromCsv({ season, teams });
      if (loaded.report.unmappedTeams.length > 0) {
        throw new Error(`fixtures.csv has unmapped teams for season ${season}: ${loaded.report.unmappedTeams.join(", ")}`);
      }
      if (loaded.report.duplicateRows > 0) {
        throw new Error(`fixtures.csv has duplicate rows for season ${season}: ${loaded.report.duplicateRows}`);
      }
      if (loaded.fixtures.length === 0) {
        throw new Error(`fixtures.csv produced no rows for season ${season}`);
      }
      fixturesBySeason.set(season, loaded);
    }

    const completed = await prisma.game.findMany({
      where: { saveId: save.id, status: { in: COMPLETED_GAME_STATUSES } },
      select: { id: true, homeTeamId: true, awayTeamId: true, gameDate: true },
    });
    const completedKeys = new Set(completed.map((g) => fixtureKey(g)));

    await prisma.game.deleteMany({
      where: {
        saveId: save.id,
        status: { notIn: COMPLETED_GAME_STATUSES },
      },
    });

    const toCreate = loaded.fixtures.filter((f) => !completedKeys.has(fixtureKey(f)));
    if (toCreate.length > 0) {
      await prisma.game.createMany({
        data: toCreate.map((f) => ({
          saveId: save.id,
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          gameDate: f.gameDate,
          status: "scheduled",
          homeScore: 0,
          awayScore: 0,
        })),
      });
    }

    const currentDateIso = String(payload.currentDate ?? save.currentDate.toISOString().slice(0, 10));
    const week = getGameweekForDate(season, currentDateIso);
    const nextPayload = {
      ...payload,
      season,
      currentDate: currentDateIso,
      week,
    };

    await prisma.save.update({
      where: { id: save.id },
      data: {
        season,
        currentDate: new Date(`${currentDateIso}T00:00:00.000Z`),
        data: nextPayload,
      },
    });

    updatedSaves += 1;
    console.log(`save ${save.id}: fixtures synced (${toCreate.length} scheduled), week=${week}`);
  }

  console.log(`Done. Updated saves: ${updatedSaves}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


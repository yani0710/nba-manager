import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { normalizePlayerName } from "../../src/data/loadSalariesRoster";
import { mapTeamCode, readCsvRowsFromPath } from "./utils";

const prisma = new PrismaClient();
const FREE_AGENT_TEAM_SHORT = "FA";

type PlayerLite = {
  id: number;
  name: string;
  teamId: number | null;
  number: number | null;
  jerseyNumber: number | null;
  salary: number | null;
  overallCurrent: number | null;
  updatedAt: Date;
};

function buildPreferredNameByTeamNorm() {
  const sourcePath = path.resolve(process.cwd(), "data", "players_cleaned_with_first_page.csv");
  const rows = readCsvRowsFromPath(sourcePath);
  const preferred = new Map<string, string>();
  for (const row of rows) {
    const rawName = String(row.Player ?? "").trim();
    const rawTeam = String(row.Team ?? "").trim().toUpperCase();
    if (!rawName || !rawTeam) continue;
    const teamCode = mapTeamCode(rawTeam);
    const norm = normalizePlayerName(rawName);
    const key = `${teamCode}|${norm}`;
    if (!preferred.has(key)) preferred.set(key, rawName);
  }
  return preferred;
}

function scorePlayer(
  player: PlayerLite,
  preferredName: string | undefined,
): number {
  let score = 0;
  if (preferredName && player.name.toLowerCase() === preferredName.toLowerCase()) score += 1_000_000;
  if (player.number != null) score += 10_000;
  if (player.jerseyNumber != null) score += 5_000;
  if (player.salary != null && player.salary > 0) score += 1_000;
  score += (player.overallCurrent ?? 0) * 10;
  score += player.updatedAt.getTime() / 1_000_000_000_000;
  return score;
}

async function main() {
  const preferredByTeamNorm = buildPreferredNameByTeamNorm();
  const freeAgentTeam = await prisma.team.findUnique({
    where: { shortName: FREE_AGENT_TEAM_SHORT },
    select: { id: true },
  });
  if (!freeAgentTeam) {
    throw new Error("Free-agent team (FA) not found.");
  }

  const players = await prisma.player.findMany({
    where: {
      active: true,
      team: { shortName: { not: FREE_AGENT_TEAM_SHORT } },
    },
    select: {
      id: true,
      name: true,
      teamId: true,
      number: true,
      jerseyNumber: true,
      salary: true,
      overallCurrent: true,
      updatedAt: true,
      team: { select: { shortName: true } },
    },
  });

  const grouped = new Map<string, Array<PlayerLite & { teamCode: string }>>();
  for (const player of players) {
    if (!player.teamId) continue;
    const teamCode = mapTeamCode(player.team?.shortName ?? "");
    const norm = normalizePlayerName(player.name);
    const key = `${player.teamId}|${norm}`;
    const list = grouped.get(key) ?? [];
    list.push({ ...player, teamCode });
    grouped.set(key, list);
  }

  const duplicateGroups = [...grouped.values()].filter((g) => g.length > 1);
  let processedGroups = 0;
  let deactivated = 0;
  const sample: Array<{ team: string; kept: string; removed: string[] }> = [];

  for (const group of duplicateGroups) {
    const teamCode = group[0].teamCode;
    const norm = normalizePlayerName(group[0].name);
    const preferredName = preferredByTeamNorm.get(`${teamCode}|${norm}`);

    const ranked = [...group].sort((a, b) => scorePlayer(b, preferredName) - scorePlayer(a, preferredName));
    const keep = ranked[0];
    const remove = ranked.slice(1);
    if (remove.length === 0) continue;

    await prisma.player.updateMany({
      where: { id: { in: remove.map((p) => p.id) } },
      data: {
        active: false,
        isActive: false,
        teamId: freeAgentTeam.id,
        number: null,
        jerseyNumber: null,
        jerseyCode: null,
      },
    });

    processedGroups += 1;
    deactivated += remove.length;
    if (sample.length < 20) {
      sample.push({
        team: teamCode,
        kept: `${keep.id}:${keep.name}`,
        removed: remove.map((p) => `${p.id}:${p.name}`),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        duplicateGroups: duplicateGroups.length,
        processedGroups,
        deactivated,
        sample,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

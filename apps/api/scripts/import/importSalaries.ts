import { PrismaClient } from "@prisma/client";
import { buildTeamRoster, normalizePlayerName } from "../../src/data/loadSalariesRoster";
import { mapTeamCode, readCsvRows, writeImportHealth } from "./utils";

const prisma = new PrismaClient();

type DbPlayer = {
  id: number;
  name: string;
  active: boolean;
  externalRef: string | null;
  team: { shortName: string };
};

function chooseBestCandidate(candidates: DbPlayer[]): DbPlayer | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => {
    // Prefer active players when duplicate records exist for same name/team.
    if (a.active !== b.active) return a.active ? -1 : 1;
    // Prefer rows with a stable externalRef when available.
    if (Boolean(a.externalRef) !== Boolean(b.externalRef)) return a.externalRef ? -1 : 1;
    return a.id - b.id;
  });
  return sorted[0] ?? null;
}

async function main() {
  const { filePath: salaryPath, players: salaryRows } = buildTeamRoster();
  const advancedRows = readCsvRows("Advanced.csv");

  const nameTeamToRef = new Map<string, string>();
  for (const row of advancedRows) {
    const name = normalizePlayerName(String(row.player ?? ""));
    const teamCode = mapTeamCode(String(row.team ?? "").toUpperCase());
    const ref = String(row.player_id ?? "").trim();
    if (!name || !teamCode || !ref) continue;
    if (!nameTeamToRef.has(`${name}|${teamCode}`)) nameTeamToRef.set(`${name}|${teamCode}`, ref);
  }

  const players = await prisma.player.findMany({
    select: { id: true, name: true, active: true, externalRef: true, team: { select: { shortName: true } } },
  });

  const byExternal = new Map<string, DbPlayer>();
  const byNameTeam = new Map<string, DbPlayer[]>();
  const byName = new Map<string, DbPlayer[]>();
  for (const player of players) {
    if (player.externalRef) byExternal.set(String(player.externalRef), player);
    const normalizedName = normalizePlayerName(player.name);
    const teamCode = mapTeamCode(player.team.shortName);
    const nameTeamKey = `${normalizedName}|${teamCode}`;
    byNameTeam.set(nameTeamKey, [...(byNameTeam.get(nameTeamKey) ?? []), player]);
    byName.set(normalizedName, [...(byName.get(normalizedName) ?? []), player]);
  }

  let matched = 0;
  let skippedNoSalary = 0;
  const unmatched: string[] = [];
  for (const row of salaryRows) {
    const playerName = String(row.rawName ?? "").trim();
    const teamCode = mapTeamCode(String(row.teamCode ?? "").trim().toUpperCase());
    const salary = row.salary ?? null;
    if (!playerName || !teamCode) continue;
    if (salary === null || salary <= 0) {
      skippedNoSalary += 1;
      continue;
    }

    const key = `${row.normalizedName}|${teamCode}`;
    const inferredRef = nameTeamToRef.get(key);
    const byNameTeamCandidates = byNameTeam.get(key) ?? [];
    const byNameCandidates = byName.get(row.normalizedName) ?? [];
    const player =
      (inferredRef ? byExternal.get(inferredRef) : null) ??
      chooseBestCandidate(byNameTeamCandidates) ??
      chooseBestCandidate(byNameCandidates) ??
      null;

    if (!player) {
      unmatched.push(`${playerName} (${teamCode})`);
      continue;
    }

    await prisma.player.update({
      where: { id: player.id },
      data: { salary },
    });
    matched += 1;
  }

  console.log(
    JSON.stringify(
      {
        file: salaryPath,
        rows: salaryRows.length,
        matched,
        unmatched: unmatched.length,
        skippedNoSalary,
      },
      null,
      2,
    ),
  );
  writeImportHealth("salaries", {
    file: salaryPath,
    matched,
    unmatched: unmatched.length,
    unmatchedSample: unmatched.slice(0, 20),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

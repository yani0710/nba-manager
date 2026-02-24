import { PrismaClient } from "@prisma/client";
import { findCsvByNameOrHeader, mapTeamCode, normalizeName, readCsvRows, readCsvRowsFromPath, toInt, writeImportHealth } from "./utils";

const prisma = new PrismaClient();

function parseSalary(value: unknown): number | null {
  return toInt(String(value ?? "").replace(/[$,]/g, ""));
}

async function main() {
  const salaryPath = findCsvByNameOrHeader("Salaries_2024_25.csv", ["player", "team", "salary"]);
  if (!salaryPath) {
    console.log(JSON.stringify({ file: "Salaries_2024_25.csv", found: false, matched: 0, unmatched: 0 }, null, 2));
    writeImportHealth("salaries", {
      file: "Salaries_2024_25.csv",
      matched: 0,
      unmatched: 0,
      unmatchedSample: [],
    });
    return;
  }

  const rows = readCsvRowsFromPath(salaryPath);
  const advancedRows = readCsvRows("Advanced.csv");
  const nameTeamToRef = new Map<string, string>();
  for (const row of advancedRows) {
    const name = normalizeName(String(row.player ?? ""));
    const teamCode = mapTeamCode(String(row.team ?? "").toUpperCase());
    const ref = String(row.player_id ?? "").trim();
    if (!name || !teamCode || !ref) continue;
    if (!nameTeamToRef.has(`${name}|${teamCode}`)) nameTeamToRef.set(`${name}|${teamCode}`, ref);
  }

  const players = await prisma.player.findMany({
    select: { id: true, name: true, externalRef: true, team: { select: { shortName: true } }, position: true },
  });
  const byExternal = new Map(players.filter((p) => p.externalRef).map((p) => [String(p.externalRef), p]));
  const byNameTeam = new Map(players.map((p) => [`${normalizeName(p.name)}|${mapTeamCode(p.team.shortName)}`, p]));

  let matched = 0;
  const unmatched: string[] = [];
  for (const row of rows) {
    const playerName = String(row.Player ?? "").trim();
    const teamCode = mapTeamCode(String(row.Team ?? "").trim().toUpperCase());
    const salary = parseSalary(row.Salary);
    if (!playerName || !teamCode || salary === null) {
      unmatched.push(`${playerName || "?"} (${teamCode || "?"})`);
      continue;
    }
    const key = `${normalizeName(playerName)}|${teamCode}`;
    const inferredRef = nameTeamToRef.get(key);
    const player =
      (inferredRef ? byExternal.get(inferredRef) : null) ??
      byNameTeam.get(key) ??
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

  console.log(JSON.stringify({ file: salaryPath, rows: rows.length, matched, unmatched: unmatched.length }, null, 2));
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


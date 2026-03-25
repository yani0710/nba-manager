import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../src/config/prisma";
import { mapTeamCode, normalizeName, readCsvRowsFromPath, toInt } from "./import/utils";

type CsvEntry = {
  player: string;
  teamCode: string;
  number: number;
};

function buildCsvMap(): Map<string, CsvEntry> {
  const sourcePath = path.resolve(process.cwd(), "data", "players_cleaned_with_first_page.csv");
  const rows = readCsvRowsFromPath(sourcePath);
  const map = new Map<string, CsvEntry>();

  for (const row of rows) {
    const player = String(row.Player ?? "").trim();
    const team = mapTeamCode(String(row.Team ?? "").trim().toUpperCase());
    const number = toInt(row.Number);
    if (!player || !team || number == null) continue;
    if (number <= 0) continue;

    const key = `${normalizeName(player)}|${team}`;
    if (!map.has(key)) {
      map.set(key, { player, teamCode: team, number });
    }
  }

  return map;
}

async function main() {
  const csvMap = buildCsvMap();
  const players = await prisma.player.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      number: true,
      jerseyNumber: true,
      jerseyCode: true,
      team: { select: { shortName: true, name: true } },
    },
    orderBy: [{ teamId: "asc" }, { name: "asc" }],
  });

  const missing: Array<{
    id: number;
    player: string;
    teamCode: string;
    teamName: string;
    dbNumber: number | null;
    dbJersey: number | null;
    dbJerseyCode: string | null;
    csvNumber: number;
  }> = [];

  for (const player of players) {
    const teamCode = mapTeamCode(player.team.shortName);
    const key = `${normalizeName(player.name)}|${teamCode}`;
    const csv = csvMap.get(key);
    if (!csv) continue;

    const hasDbNumber = player.number != null || player.jerseyNumber != null || Boolean(String(player.jerseyCode ?? "").trim());
    if (hasDbNumber) continue;

    missing.push({
      id: player.id,
      player: player.name,
      teamCode: player.team.shortName,
      teamName: player.team.name,
      dbNumber: player.number,
      dbJersey: player.jerseyNumber,
      dbJerseyCode: player.jerseyCode ?? null,
      csvNumber: csv.number,
    });
  }

  const lines: string[] = [];
  lines.push(`Active players missing jersey number in app but present in players_cleaned_with_first_page.csv: ${missing.length}`);
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("id | player | teamCode | team | appNumber | appJersey | appJerseyCode | csvNumber");
  for (const row of missing) {
    lines.push(
      `${row.id} | ${row.player} | ${row.teamCode} | ${row.teamName} | ${row.dbNumber ?? "null"} | ${row.dbJersey ?? "null"} | ${row.dbJerseyCode ?? "null"} | ${row.csvNumber}`,
    );
  }

  const outPath = path.resolve(process.cwd(), "data", "players_missing_number_from_csv.txt");
  await fs.writeFile(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Exported ${missing.length} rows to ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

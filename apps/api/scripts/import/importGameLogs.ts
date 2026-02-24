import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { chunk, mapTeamCode, normalizeName, readCsvRows, toDate, toFloat, toInt, writeImportHealth } from "./utils";

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function main() {
  const rows = readCsvRows("database_24_25.csv");
  const dataDir = path.join(process.cwd(), "data");

  const players = await prisma.player.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const playerByName = new Map(players.map((p) => [normalizeName(p.name), p.id]));

  const missedNames = new Set<string>();
  const inserts: Array<{
    playerId: number;
    date: Date;
    teamCode: string;
    oppCode: string;
    result: string | null;
    mp: number | null;
    fg: number | null;
    fga: number | null;
    tp: number | null;
    tpa: number | null;
    ft: number | null;
    fta: number | null;
    orb: number | null;
    drb: number | null;
    trb: number | null;
    ast: number | null;
    stl: number | null;
    blk: number | null;
    tov: number | null;
    pf: number | null;
    pts: number | null;
    gmSc: number | null;
  }> = [];

  for (const row of rows) {
    const rawName = String(row.Player ?? "").trim();
    const normalized = normalizeName(rawName);
    const playerId = playerByName.get(normalized);
    if (!rawName || !playerId) {
      if (rawName) missedNames.add(rawName);
      continue;
    }

    const date = toDate(row.Data);
    if (!date) continue;

    inserts.push({
      playerId,
      date,
      teamCode: mapTeamCode(String(row.Tm ?? "").trim().toUpperCase()),
      oppCode: mapTeamCode(String(row.Opp ?? "").trim().toUpperCase()),
      result: String(row.Res ?? "").trim() || null,
      mp: toFloat(row.MP),
      fg: toInt(row.FG),
      fga: toInt(row.FGA),
      tp: toInt(row["3P"]),
      tpa: toInt(row["3PA"]),
      ft: toInt(row.FT),
      fta: toInt(row.FTA),
      orb: toInt(row.ORB),
      drb: toInt(row.DRB),
      trb: toInt(row.TRB),
      ast: toInt(row.AST),
      stl: toInt(row.STL),
      blk: toInt(row.BLK),
      tov: toInt(row.TOV),
      pf: toInt(row.PF),
      pts: toInt(row.PTS),
      gmSc: toFloat(row.GmSc),
    });
  }

  let inserted = 0;
  for (const batch of chunk(inserts, BATCH_SIZE)) {
    const result = await prisma.playerGameLog.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
  }

  const missedPath = path.join(dataDir, "missed_players.json");
  fs.writeFileSync(
    missedPath,
    JSON.stringify(
      {
        totalRows: rows.length,
        matchedRows: inserts.length,
        missedCount: missedNames.size,
        missedPlayers: [...missedNames].sort(),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(JSON.stringify({ totalRows: rows.length, inserted, missedPlayers: missedNames.size, missedPath }, null, 2));
  writeImportHealth("gamelogs", {
    file: "database_24_25.csv",
    matched: inserts.length,
    unmatched: missedNames.size,
    unmatchedSample: [...missedNames].sort().slice(0, 20),
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

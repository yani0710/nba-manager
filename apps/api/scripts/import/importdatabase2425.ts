import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CSV_PATH = path.join(process.cwd(), "data", "database_24_25.csv");

// season label stored in DB
const SEASON = "2024-25";

function pick(row: any, keys: string[], fallback: any = null) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return fallback;
}

function toInt(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toFloat(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found: ${CSV_PATH}`);

  const csv = fs.readFileSync(CSV_PATH, "utf8");
  const rows: any[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  });

  console.log(`Loaded ${rows.length} rows from database_24_25.csv`);

  // Cache DB players by normalized name
  const dbPlayers = await prisma.player.findMany({
    select: { id: true, name: true },
  });
  const byName = new Map<string, number>();
  for (const p of dbPlayers) {
    byName.set(normalizeName(p.name), p.id);
  }

  let inserted = 0;
  let skippedNoPlayer = 0;
  let skippedNoDate = 0;

  // Optional: clear existing logs for that season to avoid duplicates
  console.log(`Deleting existing logs for season ${SEASON}...`);
  await prisma.playerGameLog.deleteMany({ where: { season: SEASON } });

  for (const row of rows) {
    const playerName = String(pick(row, ["Player", "player", "name", "Name"], "")).trim();
    if (!playerName) {
      skippedNoPlayer++;
      continue;
    }

    const playerId = byName.get(normalizeName(playerName));
    if (!playerId) {
      skippedNoPlayer++;
      continue;
    }

    const date = toDate(pick(row, ["Date", "date", "GAME_DATE", "Data"], null));
    if (!date) {
      skippedNoDate++;
      continue;
    }

    const teamAbbr = String(pick(row, ["Tm", "tm", "TEAM", "team"], "")).trim().toUpperCase();
    const oppAbbr = String(pick(row, ["Opp", "opp", "OPP", "opponent"], "")).trim().toUpperCase();
    const result = String(pick(row, ["Res", "res", "RESULT"], "") || "").trim() || null;

    const minutes = toFloat(pick(row, ["MP", "mp", "MIN", "minutes"], null));

    const fg = toInt(pick(row, ["FG", "fg"], null));
    const fga = toInt(pick(row, ["FGA", "fga"], null));
    const fgPct = toFloat(pick(row, ["FG%", "fg_pct", "FG_PCT"], null));

    const threeP = toInt(pick(row, ["3P", "3p", "TP", "threeP"], null));
    const threePA = toInt(pick(row, ["3PA", "3pa", "threePA"], null));
    const threePPct = toFloat(pick(row, ["3P%", "3p_pct", "THREE_PCT"], null));

    const ft = toInt(pick(row, ["FT", "ft"], null));
    const fta = toInt(pick(row, ["FTA", "fta"], null));
    const ftPct = toFloat(pick(row, ["FT%", "ft_pct", "FT_PCT"], null));

    const orb = toInt(pick(row, ["ORB", "orb"], null));
    const drb = toInt(pick(row, ["DRB", "drb"], null));
    const trb = toInt(pick(row, ["TRB", "trb", "REB"], null));
    const ast = toInt(pick(row, ["AST", "ast"], null));
    const stl = toInt(pick(row, ["STL", "stl"], null));
    const blk = toInt(pick(row, ["BLK", "blk"], null));
    const tov = toInt(pick(row, ["TOV", "tov", "TO"], null));
    const pf = toInt(pick(row, ["PF", "pf", "FOULS"], null));
    const pts = toInt(pick(row, ["PTS", "pts", "POINTS"], null));

    const gameScore = toFloat(pick(row, ["GmSc", "gmsc", "gameScore"], null));

    await prisma.playerGameLog.create({
      data: {
        season: SEASON,
        date,
        teamAbbr,
        oppAbbr,
        result,
        minutes,
        fg,
        fga,
        fgPct,
        threeP,
        threePA,
        threePPct,
        ft,
        fta,
        ftPct,
        orb,
        drb,
        trb,
        ast,
        stl,
        blk,
        tov,
        pf,
        pts,
        gameScore,
        playerId,
      },
    });

    inserted++;
  }

  console.log(`Inserted game logs: ${inserted}`);
  console.log(`Skipped (player not found): ${skippedNoPlayer}`);
  console.log(`Skipped (missing/invalid date): ${skippedNoDate}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

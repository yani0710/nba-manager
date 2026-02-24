import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CSV_PATH = path.join(process.cwd(), "data", "NBA_PLAYERS.csv");

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

function toBool(v: any): boolean | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}

function toHeightCm(v: any): number | null {
  const raw = toInt(v);
  if (raw === null) return null;
  return raw <= 100 ? Math.round(raw * 2.54) : raw;
}

function toWeightKg(v: any): number | null {
  const raw = toInt(v);
  if (raw === null) return null;
  return raw > 140 ? Math.round(raw * 0.45359237) : raw;
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  // Accept: YYYY-MM-DD, MM/DD/YYYY, etc.
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizePos(v: any): string {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return "N/A";
  // Some datasets use "G-F", "F-C", etc - keep as-is
  return s;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }

  const csv = fs.readFileSync(CSV_PATH, "utf8");
  const rows: any[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  });

  console.log(`Loaded ${rows.length} rows from NBA_PLAYERS.csv`);

  let upserts = 0;
  let skipped = 0;

  for (const row of rows) {
    // Try common column names
    const externalRefRaw = pick(row, ["player_id", "PLAYER_ID", "id", "ID", "nba_id", "NBA_ID"], null);
    const externalRef = externalRefRaw ? String(externalRefRaw) : null;

    const name = String(pick(row, ["player", "Player", "name", "Name", "PLAYER_NAME", "full_name"], "")).trim();
    if (!name) {
      skipped++;
      continue;
    }

    const teamAbbr = String(pick(row, ["Tm", "tm", "TEAM", "team", "Team", "team_abbr", "TEAM_ABBREVIATION"], "")).trim().toUpperCase();

    const position = normalizePos(pick(row, ["Pos", "pos", "Position", "position", "PLAYER_POSITION"], "N/A"));

    // Some datasets use inches/lbs. Some use cm/kg.
    const heightCm = toHeightCm(pick(row, ["heightCm", "height_cm", "Height (cm)", "height", "Height", "HEIGHT_CM"], null));
    const weightKg = toWeightKg(pick(row, ["weightKg", "weight_kg", "Weight (kg)", "weight", "Weight", "WEIGHT_KG"], null));

    const birthDate = toDate(pick(row, ["birthDate", "birth_date", "Birthday", "birthday", "DOB", "dob"], null));
    const nationality = String(pick(row, ["nationality", "Nationality", "country", "Country"], "") || "").trim() || null;
    const debutYear = toInt(pick(row, ["Debut", "debut"], null));
    const finalYear = toInt(pick(row, ["Final", "final"], null));
    const school = String(pick(row, ["School", "school"], "") || "").trim() || null;
    const hallOfFame = toBool(pick(row, ["HOF", "hof"], null));
    const isActive = toBool(pick(row, ["Active", "active", "isActive"], null));
    const gamesCareer = toInt(pick(row, ["G", "games"], null));
    const ptsCareer = toFloat(pick(row, ["PTS", "pts"], null));
    const trbCareer = toFloat(pick(row, ["TRB", "trb", "REB"], null));
    const astCareer = toFloat(pick(row, ["AST", "ast"], null));
    const fgPct = toFloat(pick(row, ["FG%", "fg_pct"], null));
    const fg3Pct = toFloat(pick(row, ["FG3%", "FG3P%", "3P%", "fg3_pct"], null));
    const ftPct = toFloat(pick(row, ["FT%", "ft_pct"], null));
    const efgPct = toFloat(pick(row, ["eFG%", "EFG%", "efg_pct"], null));
    const per = toFloat(pick(row, ["PER", "per"], null));
    const ws = toFloat(pick(row, ["WS", "ws"], null));

    // optional: overall/potential if present; otherwise leave existing
    const overall = toInt(pick(row, ["overall", "Overall", "OVR"], null));
    const potential = toInt(pick(row, ["potential", "Potential", "POT"], null));

    // Decide how to find the player in your DB:
    // 1) Prefer externalRef match
    // 2) else match by name (+ team if provided)
    let existing = null as any;

    if (externalRef) {
      existing = await prisma.player.findUnique({ where: { externalRef } }).catch(() => null);
    }
    if (!existing) {
      existing = await prisma.player.findFirst({
        where: teamAbbr
          ? { name: { equals: name, mode: "insensitive" }, team: { shortName: teamAbbr } }
          : { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
    }

    if (!existing) {
      // If player doesn't exist in your DB, we skip (because your DB already has 800 seeded players).
      // You can switch this to "create" if you want.
      skipped++;
      continue;
    }

    await prisma.player.update({
      where: { id: existing.id },
      data: {
        externalRef: externalRef ?? undefined,
        birthDate: birthDate ?? undefined,
        heightCm: heightCm ?? undefined,
        weightKg: weightKg ?? undefined,
        nationality: nationality ?? undefined,
        primaryPosition: position !== "N/A" ? position : undefined,
        debutYear: debutYear ?? undefined,
        finalYear: finalYear ?? undefined,
        school: school ?? undefined,
        hallOfFame: hallOfFame ?? undefined,
        isActive: isActive ?? undefined,
        gamesCareer: gamesCareer ?? undefined,
        ptsCareer: ptsCareer ?? undefined,
        trbCareer: trbCareer ?? undefined,
        astCareer: astCareer ?? undefined,
        fgPct: fgPct ?? undefined,
        fg3Pct: fg3Pct ?? undefined,
        ftPct: ftPct ?? undefined,
        efgPct: efgPct ?? undefined,
        per: per ?? undefined,
        ws: ws ?? undefined,
        overall: overall ?? undefined,
        potential: potential ?? undefined,
      },
    });

    upserts++;
  }

  console.log(`Updated players: ${upserts}`);
  console.log(`Skipped rows (no match / missing name): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

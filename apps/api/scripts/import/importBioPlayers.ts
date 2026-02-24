import { PrismaClient } from "@prisma/client";
import { chunk, normalizeName, readCsvRows, toBool, toDate, toFloat, toInt, writeImportHealth } from "./utils";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

function parsePositions(raw: string): { primary: string; secondary: string | null } {
  const cleaned = String(raw ?? "")
    .replace(/[\[\]"]/g, "")
    .replace(/'/g, "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return { primary: "N/A", secondary: null };
  }

  const mapToken = (t: string): string => {
    const u = t.toUpperCase();
    if (u.includes("GUARD")) return "G";
    if (u.includes("FORWARD")) return "F";
    if (u.includes("CENTER")) return "C";
    if (u === "PG" || u === "SG" || u === "SF" || u === "PF" || u === "C") return u;
    return u;
  };

  return {
    primary: mapToken(cleaned[0]),
    secondary: cleaned[1] ? mapToken(cleaned[1]) : null,
  };
}

async function main() {
  const rows = readCsvRows("NBA_PLAYERS.csv");
  const fallbackTeam = await prisma.team.findFirst({ select: { id: true } });
  if (!fallbackTeam) {
    throw new Error("No teams found. Run seed first.");
  }

  const existing = await prisma.player.findMany({
    select: { id: true, name: true },
  });
  const existingByNormName = new Map(existing.map((p) => [normalizeName(p.name), p.id]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const batches = chunk(rows, BATCH_SIZE);
  for (const batch of batches) {
    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        const name = String(row.Name ?? "").trim();
        if (!name) {
          skipped += 1;
          continue;
        }

        const norm = normalizeName(name);
        const existingId = existingByNormName.get(norm);
        const { primary, secondary } = parsePositions(row.Position);

        const heightIn = toFloat(row.Height);
        const weightLb = toFloat(row.Weight);
        const heightCm = heightIn !== null ? Math.round(heightIn * 2.54) : null;
        const weightKg = weightLb !== null ? Math.round(weightLb * 0.45359237) : null;

        const birthDate = toDate(row.Birthday);
        const computedAge = birthDate
          ? Math.max(16, new Date().getUTCFullYear() - birthDate.getUTCFullYear())
          : null;

        const payload = {
          birthDate: birthDate ?? undefined,
          heightCm: heightCm ?? undefined,
          weightKg: weightKg ?? undefined,
          age: computedAge ?? undefined,
          active: toBool(row.Active) ?? false,
          primaryPosition: primary,
          secondaryPosition: secondary ?? undefined,
          position: primary,
          nationality: "USA",
          bioSource: "nba_players_csv",
          debutYear: toInt(row.Debut) ?? undefined,
          finalYear: toInt(row.Final) ?? undefined,
          school: row.School ? String(row.School) : undefined,
          hallOfFame: toBool(row.HOF) ?? undefined,
          gamesCareer: toInt(row.G) ?? undefined,
          ptsCareer: toFloat(row.PTS) ?? undefined,
          trbCareer: toFloat(row.TRB) ?? undefined,
          astCareer: toFloat(row.AST) ?? undefined,
          fgPct: toFloat(row["FG%"]) ?? undefined,
          fg3Pct: toFloat(row["FG3%"]) ?? undefined,
          ftPct: toFloat(row["FT%"]) ?? undefined,
          efgPct: toFloat(row["eFG%"]) ?? undefined,
          per: toFloat(row.PER) ?? undefined,
          ws: toFloat(row.WS) ?? undefined,
        };

        if (existingId) {
          await tx.player.update({
            where: { id: existingId },
            data: payload,
          });
          updated += 1;
        } else {
          const created = await tx.player.create({
            data: {
              name,
              teamId: fallbackTeam.id,
              ...payload,
            },
            select: { id: true },
          });
          existingByNormName.set(norm, created.id);
          inserted += 1;
        }
      }
    });
  }

  console.log(JSON.stringify({ rows: rows.length, inserted, updated, skipped }, null, 2));
  writeImportHealth("bio", {
    file: "NBA_PLAYERS.csv",
    matched: inserted + updated,
    unmatched: skipped,
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

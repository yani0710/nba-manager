import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { chunk, mapTeamCode, normalizeName, readCsvRows, toBool, toDate, toFloat, toInt } from "./utils";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

type BioRow = {
  name: string;
  birthDate: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  active: boolean | null;
  finalYear: number | null;
  nationality: string | null;
  number: number | null;
};

function parsePosition(value: string): { primary: string; secondary: string | null } {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return { primary: "N/A", secondary: null };
  const parts = raw
    .replace(/\s+/g, "")
    .split(/[-/]/g)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    primary: parts[0] ?? raw,
    secondary: parts[1] ?? null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function deterministic(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function preferredRanges(position: string): Array<[number, number]> {
  const p = (position ?? "").toUpperCase();
  if (p.includes("PG") || p.includes("SG") || p === "G") return [[0, 15], [20, 35], [40, 99]];
  if (p.includes("PF") || p.includes("C")) return [[40, 99], [20, 35], [0, 15]];
  return [[20, 35], [0, 15], [40, 99]];
}

function pickFreeNumber(used: Set<number>, position: string, seedKey: string): number {
  const seed = deterministic(seedKey);
  for (const [start, end] of preferredRanges(position)) {
    const span = end - start + 1;
    for (let i = 0; i < span; i += 1) {
      const candidate = start + ((seed + i * 17) % span);
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
  }
  for (let n = 0; n <= 99; n += 1) {
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  return seed % 100;
}

function parseBioRows(): Map<string, BioRow> {
  const rows = readCsvRows("NBA_PLAYERS.csv");
  const out = new Map<string, BioRow>();
  for (const row of rows) {
    const name = String(row.Name ?? "").trim();
    if (!name) continue;
    const norm = normalizeName(name);
    const { primary, secondary } = parsePosition(String(row.Position ?? ""));
    const heightIn = toFloat(row.Height);
    const weightLb = toFloat(row.Weight);
    const number = toInt((row as Record<string, unknown>).number ?? (row as Record<string, unknown>).Number ?? (row as Record<string, unknown>).No);
    out.set(norm, {
      name,
      birthDate: toDate(row.Birthday),
      heightCm: heightIn !== null ? Math.round(heightIn * 2.54) : null,
      weightKg: weightLb !== null ? Math.round(weightLb * 0.45359237) : null,
      primaryPosition: primary,
      secondaryPosition: secondary,
      active: toBool(row.Active),
      finalYear: toInt(row.Final),
      nationality: null,
      number: number !== null ? clamp(number, 0, 99) : null,
    });
  }
  return out;
}

async function main() {
  const bioByName = parseBioRows();
  const advancedRows = readCsvRows("Advanced.csv");
  const gameRows = readCsvRows("database_24_25.csv");
  const latestSeason = Math.max(...advancedRows.map((r) => toInt(r.season) ?? 0));
  if (!latestSeason || !Number.isFinite(latestSeason)) {
    throw new Error("Cannot determine latest season from Advanced.csv");
  }

  const filteredAdvanced = advancedRows.filter((row) => {
    const season = toInt(row.season);
    const lg = String(row.lg ?? "").toUpperCase();
    const g = toInt(row.g) ?? 0;
    const mp = toFloat(row.mp) ?? 0;
    return season === latestSeason && lg === "NBA" && g > 0 && mp > 0;
  });

  const teams = await prisma.team.findMany({ select: { id: true, shortName: true } });
  const teamByCode = new Map(teams.map((team) => [mapTeamCode(team.shortName), team.id]));
  if (teamByCode.size === 0) {
    throw new Error("No teams in DB. Run seed first.");
  }

  const existingPlayers = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      externalRef: true,
      teamId: true,
      number: true,
      birthDate: true,
      heightCm: true,
      weightKg: true,
      nationality: true,
      primaryPosition: true,
      secondaryPosition: true,
      active: true,
    },
  });
  const byExternal = new Map(existingPlayers.filter((p) => p.externalRef).map((p) => [p.externalRef as string, p]));
  const byName = new Map(existingPlayers.map((p) => [normalizeName(p.name), p]));

  const usedNumbersByTeam = new Map<number, Set<number>>();
  for (const player of existingPlayers) {
    if (player.number === null) continue;
    const set = usedNumbersByTeam.get(player.teamId) ?? new Set<number>();
    set.add(player.number);
    usedNumbersByTeam.set(player.teamId, set);
  }

  const rosterIds = new Set<number>();
  let createdPlayers = 0;
  let updatedPlayers = 0;
  let advancedUpserts = 0;
  let skippedAdvanced = 0;

  for (const batch of chunk(filteredAdvanced, BATCH_SIZE)) {
    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        const name = String(row.player ?? "").trim();
        const norm = normalizeName(name);
        const externalRef = String(row.player_id ?? "").trim() || null;
        const teamCode = mapTeamCode(String(row.team ?? "").trim().toUpperCase());
        const teamId = teamByCode.get(teamCode);
        if (!name || !teamId) {
          skippedAdvanced += 1;
          continue;
        }

        const bio = bioByName.get(norm);
        const pos = String(row.pos ?? "").trim() || bio?.primaryPosition || "N/A";
        const { primary, secondary } = parsePosition(pos);
        const current = (externalRef ? byExternal.get(externalRef) : null) ?? byName.get(norm) ?? null;
        if (current && current.number !== null) {
          const currentPool = usedNumbersByTeam.get(current.teamId);
          currentPool?.delete(current.number);
        }
        const numberPool = usedNumbersByTeam.get(teamId) ?? new Set<number>();
        usedNumbersByTeam.set(teamId, numberPool);

        const bioNumber = bio?.number ?? null;
        let assignedNumber: number;
        if (current?.number !== null && current?.teamId === teamId && !numberPool.has(current.number)) {
          assignedNumber = current.number;
          numberPool.add(assignedNumber);
        } else if (bioNumber !== null && !numberPool.has(bioNumber)) {
          assignedNumber = bioNumber;
          numberPool.add(assignedNumber);
        } else {
          assignedNumber = pickFreeNumber(numberPool, primary, `${teamId}:${externalRef ?? norm}`);
        }

        const data = {
          teamId,
          active: true,
          externalRef: externalRef ?? undefined,
          number: assignedNumber,
          jerseyNumber: assignedNumber,
          jerseyCode: String(assignedNumber),
          position: primary,
          primaryPosition: primary,
          secondaryPosition: secondary ?? undefined,
          birthDate: bio?.birthDate ?? undefined,
          heightCm: bio?.heightCm ?? undefined,
          weightKg: bio?.weightKg ?? undefined,
          nationality: bio?.nationality ?? undefined,
          finalYear: bio?.finalYear ?? undefined,
        };

        let playerId: number;
        if (current) {
          const updated = await tx.player.update({
            where: { id: current.id },
            data,
            select: { id: true },
          });
          playerId = updated.id;
          updatedPlayers += 1;
        } else {
          const created = await tx.player.create({
            data: {
              name,
              ...data,
            },
            select: { id: true },
          });
          playerId = created.id;
          createdPlayers += 1;
          byName.set(norm, {
            id: playerId,
            name,
            externalRef,
            teamId,
            number: assignedNumber,
            birthDate: bio?.birthDate ?? null,
            heightCm: bio?.heightCm ?? null,
            weightKg: bio?.weightKg ?? null,
            nationality: null,
            primaryPosition: primary,
            secondaryPosition: secondary,
            active: true,
          });
        }

        rosterIds.add(playerId);

        await tx.playerSeasonAdvanced.upsert({
          where: {
            playerId_season: {
              playerId,
              season: latestSeason,
            },
          },
          update: {
            teamCode,
            pos: primary,
            per: toFloat(row.per) ?? undefined,
            tsPercent: toFloat(row.ts_percent) ?? undefined,
            x3pAr: toFloat(row.x3p_ar) ?? undefined,
            fTr: toFloat(row.f_tr) ?? undefined,
            orbPercent: toFloat(row.orb_percent) ?? undefined,
            drbPercent: toFloat(row.drb_percent) ?? undefined,
            trbPercent: toFloat(row.trb_percent) ?? undefined,
            astPercent: toFloat(row.ast_percent) ?? undefined,
            stlPercent: toFloat(row.stl_percent) ?? undefined,
            blkPercent: toFloat(row.blk_percent) ?? undefined,
            tovPercent: toFloat(row.tov_percent) ?? undefined,
            usgPercent: toFloat(row.usg_percent) ?? undefined,
            ows: toFloat(row.ows) ?? undefined,
            dws: toFloat(row.dws) ?? undefined,
            ws: toFloat(row.ws) ?? undefined,
            ws48: toFloat(row.ws_48) ?? undefined,
            obpm: toFloat(row.obpm) ?? undefined,
            dbpm: toFloat(row.dbpm) ?? undefined,
            bpm: toFloat(row.bpm) ?? undefined,
            vorp: toFloat(row.vorp) ?? undefined,
          },
          create: {
            playerId,
            season: latestSeason,
            teamCode,
            pos: primary,
            per: toFloat(row.per) ?? undefined,
            tsPercent: toFloat(row.ts_percent) ?? undefined,
            x3pAr: toFloat(row.x3p_ar) ?? undefined,
            fTr: toFloat(row.f_tr) ?? undefined,
            orbPercent: toFloat(row.orb_percent) ?? undefined,
            drbPercent: toFloat(row.drb_percent) ?? undefined,
            trbPercent: toFloat(row.trb_percent) ?? undefined,
            astPercent: toFloat(row.ast_percent) ?? undefined,
            stlPercent: toFloat(row.stl_percent) ?? undefined,
            blkPercent: toFloat(row.blk_percent) ?? undefined,
            tovPercent: toFloat(row.tov_percent) ?? undefined,
            usgPercent: toFloat(row.usg_percent) ?? undefined,
            ows: toFloat(row.ows) ?? undefined,
            dws: toFloat(row.dws) ?? undefined,
            ws: toFloat(row.ws) ?? undefined,
            ws48: toFloat(row.ws_48) ?? undefined,
            obpm: toFloat(row.obpm) ?? undefined,
            dbpm: toFloat(row.dbpm) ?? undefined,
            bpm: toFloat(row.bpm) ?? undefined,
            vorp: toFloat(row.vorp) ?? undefined,
          },
        });
        advancedUpserts += 1;
      }
    });
  }

  await prisma.player.updateMany({
    where: {
      id: { notIn: [...rosterIds] },
      active: true,
    },
    data: { active: false },
  });

  const activePlayers = await prisma.player.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const activeByNormName = new Map(activePlayers.map((player) => [normalizeName(player.name), player.id]));

  const missedPlayers = new Set<string>();
  const logsToInsert: Array<{
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

  for (const row of gameRows) {
    const name = String(row.Player ?? "").trim();
    if (!name) continue;
    const playerId = activeByNormName.get(normalizeName(name));
    if (!playerId) {
      missedPlayers.add(name);
      continue;
    }
    const date = toDate(row.Data ?? row.Date);
    if (!date) continue;
    logsToInsert.push({
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

  await prisma.playerGameLog.deleteMany({});
  let insertedLogs = 0;
  for (const batch of chunk(logsToInsert, 500)) {
    const result = await prisma.playerGameLog.createMany({
      data: batch,
      skipDuplicates: true,
    });
    insertedLogs += result.count;
  }

  const missingBio = await prisma.player.aggregate({
    where: { active: true },
    _count: {
      birthDate: true,
      heightCm: true,
      weightKg: true,
      nationality: true,
      number: true,
    },
  });
  const activeCount = await prisma.player.count({ where: { active: true } });

  const importReport = {
    generatedAt: new Date().toISOString(),
    latestSeason,
    activePlayers: activeCount,
    createdPlayers,
    updatedPlayers,
    advancedUpserts,
    skippedAdvanced,
    gameLogsInserted: insertedLogs,
    missedGameLogPlayers: missedPlayers.size,
    missingCounts: {
      birthDate: activeCount - (missingBio._count.birthDate ?? 0),
      heightCm: activeCount - (missingBio._count.heightCm ?? 0),
      weightKg: activeCount - (missingBio._count.weightKg ?? 0),
      nationality: activeCount - (missingBio._count.nationality ?? 0),
      number: activeCount - (missingBio._count.number ?? 0),
    },
  };

  const dataDir = path.join(process.cwd(), "data");
  fs.writeFileSync(path.join(dataDir, "import_report.json"), JSON.stringify(importReport, null, 2), "utf8");
  fs.writeFileSync(
    path.join(dataDir, "missed_players.json"),
    JSON.stringify({ count: missedPlayers.size, players: [...missedPlayers].sort() }, null, 2),
    "utf8",
  );

  console.log(JSON.stringify(importReport, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

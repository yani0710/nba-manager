import { PrismaClient } from "@prisma/client";
import { chunk, mapTeamCode, normalizeName, readCsvRows, toFloat, toInt, writeImportHealth } from "./utils";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;
const COMMON_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 20, 21, 22, 23, 24, 30, 32, 33, 34, 35, 40, 44, 45, 50, 55];

function parsePrimaryPosition(raw: string): string {
  const pos = String(raw ?? "").toUpperCase().trim();
  if (!pos) return "N/A";
  if (pos.includes("-")) return pos.split("-")[0];
  if (pos.includes("/")) return pos.split("/")[0];
  return pos;
}

function pickJerseyNumber(used: Set<number>, seed: string): number {
  for (const n of COMMON_NUMBERS) {
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let n = 0; n <= 55; n += 1) {
    const candidate = (h + n) % 56;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  return 99;
}

async function main() {
  const rows = readCsvRows("Advanced.csv");
  const latestSeason = Math.max(...rows.map((r) => toInt(r.season) ?? 0));
  if (!Number.isFinite(latestSeason) || latestSeason <= 0) {
    throw new Error("Unable to determine latest season from Advanced.csv");
  }

  const filtered = rows.filter((r) => {
    const season = toInt(r.season);
    const g = toInt(r.g) ?? 0;
    const mp = toFloat(r.mp) ?? 0;
    return season === latestSeason && String(r.lg ?? "").toUpperCase() === "NBA" && g > 0 && mp > 0;
  });

  const teams = await prisma.team.findMany({ select: { id: true, shortName: true } });
  const teamByCode = new Map(teams.map((t) => [mapTeamCode(t.shortName), t.id]));

  const existingPlayers = await prisma.player.findMany({
    select: { id: true, name: true, externalRef: true, teamId: true, number: true },
  });
  const byExternal = new Map(existingPlayers.filter((p) => p.externalRef).map((p) => [String(p.externalRef), p]));
  const byName = new Map(existingPlayers.map((p) => [normalizeName(p.name), p]));

  const usedNumbersByTeam = new Map<number, Set<number>>();
  for (const player of existingPlayers) {
    if (player.number === null) continue;
    const set = usedNumbersByTeam.get(player.teamId) ?? new Set<number>();
    set.add(player.number);
    usedNumbersByTeam.set(player.teamId, set);
  }

  let updatedPlayers = 0;
  let createdPlayers = 0;
  let advancedUpserts = 0;
  let skipped = 0;
  const rosterIds = new Set<number>();

  for (const batch of chunk(filtered, BATCH_SIZE)) {
    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        const name = String(row.player ?? "").trim();
        const normName = normalizeName(name);
        const externalRef = String(row.player_id ?? "").trim() || null;
        const teamCode = mapTeamCode(String(row.team ?? "").trim().toUpperCase());
        const teamId = teamByCode.get(teamCode);
        if (!name || !teamId) {
          skipped += 1;
          continue;
        }

        const existing = (externalRef ? byExternal.get(externalRef) : null) ?? byName.get(normName) ?? null;
        const numberSet = usedNumbersByTeam.get(teamId) ?? new Set<number>();
        usedNumbersByTeam.set(teamId, numberSet);
        if (existing?.number !== null && existing?.number !== undefined && existing.teamId === teamId) {
          numberSet.delete(existing.number);
        }
        let number: number;
        if (existing?.number !== null && existing?.number !== undefined && !numberSet.has(existing.number)) {
          number = existing.number;
          numberSet.add(number);
        } else {
          number = pickJerseyNumber(numberSet, `${teamCode}:${externalRef ?? normName}`);
        }

        const position = parsePrimaryPosition(String(row.pos ?? ""));
        const age = toInt(row.age);
        const playerData = {
          name,
          externalRef: externalRef ?? undefined,
          teamId,
          active: true,
          position,
          primaryPosition: position,
          age: age ?? undefined,
          number,
          jerseyNumber: number,
        };

        let playerId: number;
        if (existing) {
          const updated = await tx.player.update({
            where: { id: existing.id },
            data: playerData,
            select: { id: true },
          });
          playerId = updated.id;
          updatedPlayers += 1;
        } else {
          const created = await tx.player.create({
            data: {
              ...playerData,
              nationality: "USA",
              bioSource: "default",
            },
            select: { id: true },
          });
          playerId = created.id;
          createdPlayers += 1;
          byName.set(normName, { id: playerId, name, externalRef, teamId, number });
          if (externalRef) byExternal.set(externalRef, { id: playerId, name, externalRef, teamId, number });
        }

        await tx.playerSeasonAdvanced.upsert({
          where: { playerId_season: { playerId, season: latestSeason } },
          update: {
            teamCode,
            pos: position,
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
            pos: position,
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
        rosterIds.add(playerId);
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

  console.log(
    JSON.stringify(
      {
        latestSeason,
        sourceRows: rows.length,
        filteredRows: filtered.length,
        createdPlayers,
        updatedPlayers,
        advancedUpserts,
        skipped,
      },
      null,
      2,
    ),
  );
  writeImportHealth("advanced", {
    file: "Advanced.csv",
    season: latestSeason,
    matched: advancedUpserts,
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

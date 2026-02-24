import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  deriveFallbackForm,
  derivePlayerFormFromGameScores,
  deriveRatingsForLeague,
  deriveTeamForm,
} from "../../src/engine/ratings/deriveRatings";
import { chunk } from "./utils";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function deterministicNoise(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = x - Math.floor(x);
  return Math.round(min + frac * (max - min));
}

function toStartForm(overall: number, perfSignal: number, seed: number, hasStats: boolean): number {
  if (!hasStats) {
    return clamp(overall + deterministicNoise(seed + 17, -10, 5), 35, 85);
  }
  return clamp(overall + deterministicNoise(seed, -8, 8) + perfSignal, 30, 99);
}

function ageOnDate(birthDate: Date | null, seasonYear: number): number {
  if (!birthDate) return 27;
  const reference = new Date(`${seasonYear}-10-01T00:00:00.000Z`);
  let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = reference.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && reference.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return Math.max(18, Math.min(40, age));
}

async function main() {
  const latest = await prisma.playerSeasonAdvanced.aggregate({ _max: { season: true } });
  const latestSeason = latest._max.season;
  if (!latestSeason) {
    throw new Error("No PlayerSeasonAdvanced records found. Run import:advanced first.");
  }

  const roster = await prisma.player.findMany({
    where: { active: true },
    select: {
      id: true,
      externalRef: true,
      birthDate: true,
      teamId: true,
      seasonAdvanced: {
        where: { season: latestSeason },
        take: 1,
      },
    },
  });

  const ratingInputs = roster
    .filter((p) => p.seasonAdvanced.length > 0)
    .map((p) => ({
      id: p.id,
      externalRef: p.externalRef,
      age: ageOnDate(p.birthDate, latestSeason),
      advanced: {
        pos: p.seasonAdvanced[0].pos,
        per: p.seasonAdvanced[0].per,
        tsPercent: p.seasonAdvanced[0].tsPercent,
        x3pAr: p.seasonAdvanced[0].x3pAr,
        orbPercent: p.seasonAdvanced[0].orbPercent,
        drbPercent: p.seasonAdvanced[0].drbPercent,
        trbPercent: p.seasonAdvanced[0].trbPercent,
        astPercent: p.seasonAdvanced[0].astPercent,
        stlPercent: p.seasonAdvanced[0].stlPercent,
        blkPercent: p.seasonAdvanced[0].blkPercent,
        tovPercent: p.seasonAdvanced[0].tovPercent,
        usgPercent: p.seasonAdvanced[0].usgPercent,
        ws48: p.seasonAdvanced[0].ws48,
        obpm: p.seasonAdvanced[0].obpm,
        dbpm: p.seasonAdvanced[0].dbpm,
        bpm: p.seasonAdvanced[0].bpm,
        vorp: p.seasonAdvanced[0].vorp,
      },
    }));

  const ratingMap = deriveRatingsForLeague(ratingInputs);

  const logs = await prisma.playerGameLog.findMany({
    where: { player: { active: true } },
    select: { playerId: true, gmSc: true, date: true },
    orderBy: [{ playerId: "asc" }, { date: "desc" }],
  });

  const gmScByPlayer = new Map<number, number[]>();
  for (const row of logs) {
    if (row.gmSc === null) continue;
    const arr = gmScByPlayer.get(row.playerId) ?? [];
    arr.push(row.gmSc);
    gmScByPlayer.set(row.playerId, arr);
  }

  const updates: Array<{ id: number; overall: number; potential: number; attributes: unknown; form: number }> = [];
  for (const p of ratingInputs) {
    const derived = ratingMap.get(p.id);
    if (!derived) continue;
    const playerScores = gmScByPlayer.get(p.id) ?? [];
    const fallbackForm = deriveFallbackForm(p.advanced.bpm, p.advanced.ws48);
    const gmscTrend = playerScores.length > 0 ? derivePlayerFormFromGameScores(playerScores) : 0;
    const perfSignal = clamp(Math.round(fallbackForm * 1.2 + gmscTrend * 1.6), -12, 16);
    const form = toStartForm(derived.overall, perfSignal, p.id, playerScores.length > 0 || fallbackForm !== 0);

    updates.push({
      id: p.id,
      overall: derived.overall,
      potential: derived.potential,
      attributes: derived.attributes,
      form,
    });
  }

  for (const batch of chunk(updates, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((u) =>
        prisma.player.update({
          where: { id: u.id },
          data: {
            overall: u.overall,
            potential: u.potential,
            attributes: u.attributes as never,
          },
        }),
      ),
    );
  }

  const formByPlayerId = new Map(updates.map((u) => [String(u.id), u.form]));

  const saves = await prisma.save.findMany({
    select: { id: true, data: true },
  });
  for (const save of saves) {
    const payload = ((save.data ?? {}) as Record<string, unknown>);
    const playerState = (payload.playerState ?? {}) as Record<string, {
      fatigue: number;
      morale: number;
      form: number;
      effectiveOverall?: number;
      formHistory?: number[];
      gamesSinceDrift?: number;
      gamesPlayed?: number;
    }>;
    for (const [pid, form] of formByPlayerId.entries()) {
      const playerId = Number(pid);
      const baseOverall = updates.find((u) => u.id === playerId)?.overall ?? 60;
      const prev = playerState[pid] ?? { fatigue: 10, morale: 65, form: 60 };
      playerState[pid] = {
        ...prev,
        form,
        effectiveOverall: prev.effectiveOverall ?? baseOverall,
        formHistory: [...(prev.formHistory ?? []), form].slice(-15),
        gamesSinceDrift: prev.gamesSinceDrift ?? 0,
        gamesPlayed: prev.gamesPlayed ?? 0,
      };
    }

    const recentGames = await prisma.game.findMany({
      where: { saveId: save.id, status: "final" },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, gameDate: true },
      orderBy: { gameDate: "desc" },
      take: 300,
    });
    const byTeam = new Map<number, Array<"W" | "L">>();
    for (const g of recentGames) {
      const homeRes: "W" | "L" = g.homeScore > g.awayScore ? "W" : "L";
      const awayRes: "W" | "L" = g.awayScore > g.homeScore ? "W" : "L";
      const homeList = byTeam.get(g.homeTeamId) ?? [];
      const awayList = byTeam.get(g.awayTeamId) ?? [];
      if (homeList.length < 5) homeList.push(homeRes);
      if (awayList.length < 5) awayList.push(awayRes);
      byTeam.set(g.homeTeamId, homeList);
      byTeam.set(g.awayTeamId, awayList);
    }
    const teamStatePayload = (payload.teamState ?? {}) as Record<string, {
      form?: number;
      last5?: string;
      streak?: number;
      offenseRating?: number;
      defenseRating?: number;
    }>;
    const teamState: Record<string, { form: number; last5: string; streak: number; offenseRating: number; defenseRating: number }> = {};
    for (const [teamId, results] of byTeam.entries()) {
      const key = String(teamId);
      const last5Results = results.slice(0, 5);
      const form = clamp(50 + deriveTeamForm(last5Results) * 4, 0, 100);
      teamState[key] = {
        form,
        last5: last5Results.join(""),
        streak: teamStatePayload[key]?.streak ?? 0,
        offenseRating: teamStatePayload[key]?.offenseRating ?? 75,
        defenseRating: teamStatePayload[key]?.defenseRating ?? 75,
      };
    }

    await prisma.save.update({
      where: { id: save.id },
      data: {
        data: {
          ...payload,
          playerState,
          teamState,
        },
      },
    });
  }

  const activePlayers = await prisma.player.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      overall: true,
      birthDate: true,
      heightCm: true,
      weightKg: true,
      primaryPosition: true,
      team: { select: { shortName: true } },
    },
    orderBy: { overall: "desc" },
  });

  const perTeamRows = await prisma.player.groupBy({
    by: ["teamId"],
    where: { active: true },
    _count: { _all: true },
  });
  const teams = await prisma.team.findMany({ select: { id: true, shortName: true, name: true } });
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const perTeam = perTeamRows.map((row) => ({
    teamId: row.teamId,
    shortName: teamMap.get(row.teamId)?.shortName ?? "UNK",
    name: teamMap.get(row.teamId)?.name ?? "Unknown",
    count: row._count._all,
  }));

  const missingBioFields = activePlayers.filter(
    (p) => !p.birthDate || p.heightCm === null || p.weightKg === null || !p.primaryPosition,
  ).length;

  const report = {
    generatedAt: new Date().toISOString(),
    latestSeason,
    totalActivePlayers: activePlayers.length,
    perTeamRosterCounts: perTeam.sort((a, b) => b.count - a.count),
    top10Overall: activePlayers.slice(0, 10).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team?.shortName ?? "FA",
      overall: p.overall,
    })),
    playersMissingBioFields: missingBioFields,
  };

  const reportPath = path.join(process.cwd(), "data", "import_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

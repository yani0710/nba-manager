import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { computeImpactRatings, computeTeamForm } from "../src/engine/ratings/impactRatings";
import { mapTeamCode, normalizeName, readCsvRows, toFloat, toInt } from "./import/utils";

const prisma = new PrismaClient();

type ImpactRow = {
  teamCode: string;
  playerName: string;
  position: string;
  minutes: number | null;
  onBallPercent: number;
  dpm: number;
  odpm: number;
  ddpm: number;
  pts: number;
  ptsCreated: number;
  ast: number;
  rimAst: number;
  reb: number;
  tsPercent: number;
  rtsPercent: number;
  tov: number;
  cTovPercent: number;
  twoPointPercent: number;
  threePointPercent: number;
  threePointAttempts: number;
  ftPercent: number;
  fta: number;
  oreb: number;
  dreb: number;
  stl: number;
  blk: number;
};

function parsePercent(row: Record<string, string>, key: string): number {
  return toFloat(row[key]) ?? 0;
}

function normalizeMatchName(input: string): string {
  return normalizeName(
    String(input ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
}

function parseRow(row: Record<string, string>): ImpactRow | null {
  const teamCode = mapTeamCode(String(row.Team ?? "").trim().toUpperCase());
  const playerName = String(row.Player ?? "").trim();
  if (!teamCode || !playerName) return null;

  return {
    teamCode,
    playerName,
    position: String(row.Pos ?? "").trim() || "N/A",
    minutes: toFloat(row.MIN),
    onBallPercent: parsePercent(row, "OnBall%"),
    dpm: toFloat(row.DPM) ?? 0,
    odpm: toFloat(row.ODPM) ?? 0,
    ddpm: toFloat(row.DDPM) ?? 0,
    pts: toFloat(row.PTS) ?? 0,
    ptsCreated: toFloat(row.CREATED_PTS) ?? 0,
    ast: toFloat(row.AST) ?? 0,
    rimAst: toFloat(row.Rim_AST) ?? 0,
    reb: toFloat(row.REB) ?? 0,
    tsPercent: parsePercent(row, "TS%"),
    rtsPercent: parsePercent(row, "rTS%"),
    tov: toFloat(row.TOV) ?? 0,
    cTovPercent: parsePercent(row, "cTOV%"),
    twoPointPercent: parsePercent(row, "2P%"),
    threePointPercent: parsePercent(row, "3P%"),
    threePointAttempts: toFloat(row["3PA"]) ?? 0,
    ftPercent: parsePercent(row, "FT%"),
    fta: toFloat(row.FTA) ?? 0,
    oreb: toFloat(row.OREB) ?? 0,
    dreb: toFloat(row.DREB) ?? 0,
    stl: toFloat(row.STL) ?? 0,
    blk: toFloat(row.BLK) ?? 0,
  };
}

async function resolveSeason(): Promise<number> {
  const explicit = toInt(process.env.IMPACT_SEASON);
  if (explicit && explicit > 0) return explicit;

  const latest = await prisma.playerSeasonAdvanced.aggregate({ _max: { season: true } });
  if (latest._max.season) return latest._max.season;

  const envSeason = Number(process.env.NBA_SEASON ?? "2025");
  return Number.isFinite(envSeason) ? envSeason + 1 : 2026;
}

async function main() {
  const csvPath = path.join(process.cwd(), "data", "impact_stats.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Missing dataset file: ${csvPath}`);
  }

  const season = await resolveSeason();
  const rows = readCsvRows("impact_stats.csv");
  const parsed = rows.map(parseRow).filter((r): r is ImpactRow => r !== null);

  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      team: { select: { shortName: true } },
    },
  });

  const playerByNameTeam = new Map<string, number>();
  for (const player of players) {
    const teamCode = mapTeamCode(String(player.team.shortName ?? "").toUpperCase());
    const key = `${normalizeMatchName(player.name)}|${teamCode}`;
    if (!playerByNameTeam.has(key)) {
      playerByNameTeam.set(key, player.id);
    }
  }

  const missingPlayers: string[] = [];
  const processed: Array<{ playerId: number; teamCode: string; input: ImpactRow }> = [];

  for (const row of parsed) {
    const key = `${normalizeMatchName(row.playerName)}|${row.teamCode}`;
    const playerId = playerByNameTeam.get(key);
    if (!playerId) {
      const label = `${row.playerName} (${row.teamCode})`;
      missingPlayers.push(label);
      console.warn(`[impact] player not found: ${label}`);
      continue;
    }
    processed.push({ playerId, teamCode: row.teamCode, input: row });
  }

  if (processed.length === 0) {
    console.log(
      JSON.stringify(
        {
          season,
          totalPlayersProcessed: 0,
          missingPlayers: missingPlayers.length,
          averageOverall: 0,
        },
        null,
        2,
      ),
    );
    return;
  }

  const ratings = computeImpactRatings(
    processed.map((row) => ({
      position: row.input.position,
      pts: row.input.pts,
      ast: row.input.ast,
      reb: row.input.reb,
      tsPercent: row.input.tsPercent,
      threePointPercent: row.input.threePointPercent,
      dpm: row.input.dpm,
      ddpm: row.input.ddpm,
      onBallPercent: row.input.onBallPercent,
      stl: row.input.stl,
      blk: row.input.blk,
      rtsPercent: row.input.rtsPercent,
      dreb: row.input.dreb,
    })),
  );

  const playerUpdates = processed.map((row, idx) => ({
    playerId: row.playerId,
    teamCode: row.teamCode,
    input: row.input,
    rating: ratings[idx],
  }));

  for (const row of playerUpdates) {
    await prisma.playerSeasonAdvanced.upsert({
      where: {
        playerId_season: {
          playerId: row.playerId,
          season,
        },
      },
      update: {
        teamCode: row.teamCode,
        pos: row.input.position || "N/A",
        minutes: row.input.minutes ?? undefined,
        onBallPercent: row.input.onBallPercent,
        dpm: row.input.dpm,
        odpm: row.input.odpm,
        ddpm: row.input.ddpm,
        pts: row.input.pts,
        ptsCreated: row.input.ptsCreated,
        ast: row.input.ast,
        rimAst: row.input.rimAst,
        reb: row.input.reb,
        tsPercent: row.input.tsPercent,
        rtsPercent: row.input.rtsPercent,
        tov: row.input.tov,
        cTovPercent: row.input.cTovPercent,
        twoPointPercent: row.input.twoPointPercent,
        threePointPercent: row.input.threePointPercent,
        threePointAttempts: row.input.threePointAttempts,
        ftPercent: row.input.ftPercent,
        fta: row.input.fta,
        oreb: row.input.oreb,
        dreb: row.input.dreb,
        stl: row.input.stl,
        blk: row.input.blk,
      },
      create: {
        playerId: row.playerId,
        season,
        teamCode: row.teamCode,
        pos: row.input.position || "N/A",
        minutes: row.input.minutes ?? undefined,
        onBallPercent: row.input.onBallPercent,
        dpm: row.input.dpm,
        odpm: row.input.odpm,
        ddpm: row.input.ddpm,
        pts: row.input.pts,
        ptsCreated: row.input.ptsCreated,
        ast: row.input.ast,
        rimAst: row.input.rimAst,
        reb: row.input.reb,
        tsPercent: row.input.tsPercent,
        rtsPercent: row.input.rtsPercent,
        tov: row.input.tov,
        cTovPercent: row.input.cTovPercent,
        twoPointPercent: row.input.twoPointPercent,
        threePointPercent: row.input.threePointPercent,
        threePointAttempts: row.input.threePointAttempts,
        ftPercent: row.input.ftPercent,
        fta: row.input.fta,
        oreb: row.input.oreb,
        dreb: row.input.dreb,
        stl: row.input.stl,
        blk: row.input.blk,
      },
    });

    await prisma.player.update({
      where: { id: row.playerId },
      data: {
        offensiveRating: row.rating.offensiveRating,
        defensiveRating: row.rating.defensiveRating,
        physicalRating: row.rating.physicalRating,
        iqRating: row.rating.iqRating,
        overall: row.rating.overall,
        form: row.rating.form,
      },
    });
  }

  const playersByTeam = new Map<string, Array<{ overall: number; dpm: number }>>();
  for (const row of playerUpdates) {
    const list = playersByTeam.get(row.teamCode) ?? [];
    list.push({
      overall: row.rating.overall,
      dpm: row.input.dpm,
    });
    playersByTeam.set(row.teamCode, list);
  }

  const teamForms = new Map<string, number>();
  for (const [teamCode, teamPlayers] of playersByTeam.entries()) {
    teamForms.set(teamCode, computeTeamForm(teamPlayers));
  }

  const teams = await prisma.team.findMany({
    select: { id: true, shortName: true },
  });
  const teamIdByCode = new Map(
    teams.map((team) => [mapTeamCode(String(team.shortName).toUpperCase()), team.id]),
  );

  const saves = await prisma.save.findMany({
    select: { id: true, data: true },
  });

  for (const save of saves) {
    const payload = (save.data ?? {}) as Record<string, unknown>;
    const teamState = ((payload.teamState ?? {}) as Record<string, {
      form?: number;
      last5?: string;
      streak?: number;
      offenseRating?: number;
      defenseRating?: number;
    }>);
    const playerState = ((payload.playerState ?? {}) as Record<string, {
      fatigue?: number;
      morale?: number;
      form?: number;
      effectiveOverall?: number;
      formHistory?: number[];
      gamesSinceDrift?: number;
      gamesPlayed?: number;
    }>);

    for (const [teamCode, form] of teamForms.entries()) {
      const teamId = teamIdByCode.get(teamCode);
      if (!teamId) continue;
      const key = String(teamId);
      teamState[key] = {
        ...teamState[key],
        form,
        last5: teamState[key]?.last5 ?? "",
        streak: teamState[key]?.streak ?? 0,
        offenseRating: teamState[key]?.offenseRating ?? 75,
        defenseRating: teamState[key]?.defenseRating ?? 75,
      };
    }

    for (const row of playerUpdates) {
      const key = String(row.playerId);
      const prev = playerState[key] ?? {};
      playerState[key] = {
        fatigue: prev.fatigue ?? 10,
        morale: prev.morale ?? 65,
        form: row.rating.form,
        effectiveOverall: row.rating.overall,
        formHistory: [...(prev.formHistory ?? []), row.rating.form].slice(-15),
        gamesSinceDrift: prev.gamesSinceDrift ?? 0,
        gamesPlayed: prev.gamesPlayed ?? 0,
      };
    }

    await prisma.save.update({
      where: { id: save.id },
      data: {
        data: {
          ...payload,
          teamState,
          playerState,
        },
      },
    });
  }

  const averageOverall = Math.round(
    playerUpdates.reduce((sum, row) => sum + row.rating.overall, 0) / playerUpdates.length,
  );

  console.log(
    JSON.stringify(
      {
        season,
        totalRowsRead: rows.length,
        totalPlayersProcessed: playerUpdates.length,
        missingPlayers: missingPlayers.length,
        averageOverall,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

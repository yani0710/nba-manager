import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { computeImpactRatings } from "../../src/engine/ratings/impactRatings";
import { findCsvByNameOrHeader, findImpactCsvPath, mapTeamCode, normalizeName, readCsvRows, readCsvRowsFromPath, toFloat, toInt, writeImportHealth } from "./utils";

const prisma = new PrismaClient();

type ImpactRow = {
  teamCode: string;
  playerName: string;
  position: string;
  minTotal: number;
  mpg: number;
  onBallPct: number;
  dpm: number;
  odpm: number;
  ddpm: number;
  pts: number;
  ptsCreated: number;
  ast: number;
  rimAst: number;
  reb: number;
  ts: number;
  rts: number;
  tov: number;
  ctovPct: number;
  twoPpct: number;
  threePpct: number;
  threePA: number;
  ftPct: number;
  fta: number;
  oreb: number;
  dreb: number;
  stl: number;
  blk: number;
};

function parseImpactRow(row: Record<string, string>): ImpactRow | null {
  const playerName = String(row.Player ?? "").trim();
  const teamCode = mapTeamCode(String(row.Team ?? "").trim().toUpperCase());
  if (!playerName || !teamCode) return null;
  return {
    teamCode,
    playerName,
    position: String(row.Pos ?? "").trim() || "N/A",
    minTotal: toFloat(row.MIN) ?? 0,
    mpg: toFloat(row.MPG) ?? 0,
    onBallPct: toFloat(row["OnBall%"]) ?? 0,
    dpm: toFloat(row.DPM) ?? 0,
    odpm: toFloat(row.ODPM) ?? 0,
    ddpm: toFloat(row.DDPM) ?? 0,
    pts: toFloat(row.PTS) ?? 0,
    ptsCreated: toFloat(row.CREATED_PTS) ?? 0,
    ast: toFloat(row.AST) ?? 0,
    rimAst: toFloat(row.Rim_AST) ?? 0,
    reb: toFloat(row.REB) ?? 0,
    ts: toFloat(row["TS%"]) ?? 0,
    rts: toFloat(row["rTS%"]) ?? 0,
    tov: toFloat(row.TOV) ?? 0,
    ctovPct: toFloat(row["cTOV%"]) ?? 0,
    twoPpct: toFloat(row["2P%"]) ?? 0,
    threePpct: toFloat(row["3P%"]) ?? 0,
    threePA: toFloat(row["3PA"]) ?? 0,
    ftPct: toFloat(row["FT%"]) ?? 0,
    fta: toFloat(row.FTA) ?? 0,
    oreb: toFloat(row.OREB) ?? 0,
    dreb: toFloat(row.DREB) ?? 0,
    stl: toFloat(row.STL) ?? 0,
    blk: toFloat(row.BLK) ?? 0,
  };
}

function seededFormFromRatings(att: number, play: number, def: number, phy: number, iq: number): number {
  const weighted = att * 0.28 + play * 0.22 + def * 0.2 + phy * 0.16 + iq * 0.14;
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

async function main() {
  const impactPath =
    findCsvByNameOrHeader("impact.csv", ["team,player,pos,min,mpg,onball%", "created_pts"]) ??
    findImpactCsvPath();
  const rows = readCsvRowsFromPath(impactPath);
  const parsed = rows.map(parseImpactRow).filter((x): x is ImpactRow => x !== null);
  const latestSeasonAgg = await prisma.playerSeasonAdvanced.aggregate({ _max: { season: true } });
  const season = latestSeasonAgg._max.season ?? (toInt(process.env.NBA_SEASON) ?? 2025) + 1;

  const advancedRows = readCsvRows("Advanced.csv");
  const advancedNameTeamToRef = new Map<string, string>();
  for (const row of advancedRows) {
    const name = normalizeName(String(row.player ?? ""));
    const teamCode = mapTeamCode(String(row.team ?? "").trim().toUpperCase());
    const ref = String(row.player_id ?? "").trim();
    if (!name || !teamCode || !ref) continue;
    advancedNameTeamToRef.set(`${name}|${teamCode}`, ref);
  }

  const teams = await prisma.team.findMany({ select: { id: true, shortName: true } });
  const teamByCode = new Map(teams.map((t) => [mapTeamCode(t.shortName), t.id]));

  const players = await prisma.player.findMany({
    select: { id: true, name: true, externalRef: true, overallBase: true, team: { select: { shortName: true } }, heightCm: true, weightKg: true },
  });
  const byExternal = new Map(players.filter((p) => p.externalRef).map((p) => [String(p.externalRef), p]));
  const byNameTeam = new Map(players.map((p) => [`${normalizeName(p.name)}|${mapTeamCode(p.team.shortName)}`, p]));

  const advanced = await prisma.playerSeasonAdvanced.findMany({
    where: { season },
    select: { playerId: true, teamCode: true },
  });
  const playerIdToTeamCode = new Map(advanced.map((a) => [a.playerId, mapTeamCode(a.teamCode)]));

  const missingPlayers: string[] = [];
  const matched: Array<{ playerId: number; row: ImpactRow; heightCm: number | null; weightKg: number | null }> = [];

  for (const row of parsed) {
    const normKey = `${normalizeName(row.playerName)}|${row.teamCode}`;
    const inferredRef = advancedNameTeamToRef.get(normKey);
    let player = (inferredRef ? byExternal.get(inferredRef) : null) ?? byNameTeam.get(normKey) ?? null;
    if (!player) {
      // fallback by name only, then verify team from latest advanced row
      const byNameOnly = players.find((p) => normalizeName(p.name) === normalizeName(row.playerName));
      if (byNameOnly && playerIdToTeamCode.get(byNameOnly.id) === row.teamCode) {
        player = byNameOnly;
      }
    }
    if (!player) {
      missingPlayers.push(`${row.playerName} (${row.teamCode})`);
      continue;
    }
    matched.push({ playerId: player.id, row, heightCm: player.heightCm, weightKg: player.weightKg });
  }

  const ratings = computeImpactRatings(
    matched.map((m) => ({
      playerId: m.playerId,
      position: m.row.position,
      heightCm: m.heightCm,
      weightKg: m.weightKg,
      mpg: m.row.mpg,
      minTotal: m.row.minTotal,
      onBallPct: m.row.onBallPct,
      dpm: m.row.dpm,
      odpm: m.row.odpm,
      ddpm: m.row.ddpm,
      pts: m.row.pts,
      ptsCreated: m.row.ptsCreated,
      ast: m.row.ast,
      rimAst: m.row.rimAst,
      reb: m.row.reb,
      ts: m.row.ts,
      rts: m.row.rts,
      tov: m.row.tov,
      ctovPct: m.row.ctovPct,
      twoPpct: m.row.twoPpct,
      threePpct: m.row.threePpct,
      threePA: m.row.threePA,
      ftPct: m.row.ftPct,
      fta: m.row.fta,
      oreb: m.row.oreb,
      dreb: m.row.dreb,
      stl: m.row.stl,
      blk: m.row.blk,
    })),
  );
  const ratingByPlayerId = new Map(ratings.map((r) => [r.playerId, r]));
  const teamRatingRows = new Map<string, Array<{ overallCurrent: number }>>();

  const playerNameById = new Map(players.map((p) => [p.id, p.name]));
  const changes: Array<{ id: number; name: string; before: number; after: number; delta: number }> = [];

  for (const match of matched) {
    const teamId = teamByCode.get(match.row.teamCode);
    const rating = ratingByPlayerId.get(match.playerId);
    if (!teamId || !rating) continue;
    const seededForm = seededFormFromRatings(rating.att, rating.play, rating.def, rating.phy, rating.iq);
    const overallCurrent = Math.round(Math.max(40, Math.min(99, rating.overall + (seededForm - 50) * 0.2)));

    await prisma.playerSeasonImpact.upsert({
      where: { playerId_season: { playerId: match.playerId, season } },
      update: {
        teamCode: match.row.teamCode,
        mpg: match.row.mpg,
        minTotal: match.row.minTotal,
        onBallPct: match.row.onBallPct,
        dpm: match.row.dpm,
        odpm: match.row.odpm,
        ddpm: match.row.ddpm,
        pts: match.row.pts,
        ptsCreated: match.row.ptsCreated,
        ast: match.row.ast,
        rimAst: match.row.rimAst,
        reb: match.row.reb,
        ts: match.row.ts,
        rts: match.row.rts,
        tov: match.row.tov,
        ctovPct: match.row.ctovPct,
        twoPpct: match.row.twoPpct,
        threePpct: match.row.threePpct,
        threePA: match.row.threePA,
        ftPct: match.row.ftPct,
        fta: match.row.fta,
        oreb: match.row.oreb,
        dreb: match.row.dreb,
        stl: match.row.stl,
        blk: match.row.blk,
      },
      create: {
        playerId: match.playerId,
        season,
        teamCode: match.row.teamCode,
        mpg: match.row.mpg,
        minTotal: match.row.minTotal,
        onBallPct: match.row.onBallPct,
        dpm: match.row.dpm,
        odpm: match.row.odpm,
        ddpm: match.row.ddpm,
        pts: match.row.pts,
        ptsCreated: match.row.ptsCreated,
        ast: match.row.ast,
        rimAst: match.row.rimAst,
        reb: match.row.reb,
        ts: match.row.ts,
        rts: match.row.rts,
        tov: match.row.tov,
        ctovPct: match.row.ctovPct,
        twoPpct: match.row.twoPpct,
        threePpct: match.row.threePpct,
        threePA: match.row.threePA,
        ftPct: match.row.ftPct,
        fta: match.row.fta,
        oreb: match.row.oreb,
        dreb: match.row.dreb,
        stl: match.row.stl,
        blk: match.row.blk,
      },
    });

    await prisma.player.update({
      where: { id: match.playerId },
      data: {
        position: rating.positionGroup,
        primaryPosition: rating.positionGroup,
        offensiveRating: rating.att,
        defensiveRating: rating.def,
        physicalRating: rating.phy,
        iqRating: rating.iq,
        overallBase: rating.overall,
        form: seededForm,
        morale: 65,
        fatigue: 10,
        overallCurrent,
        overall: overallCurrent,
        attributes: rating.attributes as never,
      },
    });
    const previousBase = players.find((p) => p.id === match.playerId)?.overallBase ?? 60;
    changes.push({
      id: match.playerId,
      name: playerNameById.get(match.playerId) ?? `#${match.playerId}`,
      before: previousBase,
      after: rating.overall,
      delta: rating.overall - previousBase,
    });

    const list = teamRatingRows.get(match.row.teamCode) ?? [];
    list.push({ overallCurrent });
    teamRatingRows.set(match.row.teamCode, list);
  }

  for (const [teamCode, rowsForTeam] of teamRatingRows.entries()) {
    const teamId = teamByCode.get(teamCode);
    if (!teamId || rowsForTeam.length === 0) continue;
    const avg = rowsForTeam.reduce((s, r) => s + r.overallCurrent, 0) / rowsForTeam.length;
    await prisma.team.update({
      where: { id: teamId },
      data: {
        form: Math.round(Math.max(0, Math.min(100, 50 + (avg - 70) * 1.2))),
        morale: 50,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        season,
        impactFile: impactPath,
        totalRows: rows.length,
        processed: matched.length,
        missingPlayers: missingPlayers.length,
        missingSample: missingPlayers.slice(0, 20),
      },
      null,
      2,
    ),
  );

  const averageOverall = matched.length > 0
    ? Number((matched.reduce((sum, m) => {
      const r = ratingByPlayerId.get(m.playerId);
      return sum + (r?.overall ?? 60);
    }, 0) / matched.length).toFixed(2))
    : 0;
  const sortedChanges = [...changes].sort((a, b) => b.delta - a.delta);
  const ratingsStatePath = path.join(process.cwd(), "data", "ratings_state.json");
  fs.writeFileSync(
    ratingsStatePath,
    JSON.stringify(
      {
        lastRatingsRecalcAt: new Date().toISOString(),
        seasonUsed: season,
        playersUpdated: matched.length,
        averageOverall,
        top5Changes: sortedChanges.slice(0, 5),
        bottom5Changes: [...sortedChanges].reverse().slice(0, 5),
      },
      null,
      2,
    ),
    "utf8",
  );

  writeImportHealth("impact", {
    file: impactPath,
    season,
    matched: matched.length,
    unmatched: missingPlayers.length,
    unmatchedSample: missingPlayers.slice(0, 20),
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

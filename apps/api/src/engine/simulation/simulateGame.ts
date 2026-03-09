/**
 * Pure simulation logic - no DB access, no HTTP
 * Used by services to compute game outcomes
 */

export interface SimPlayerInput {
  playerId: number;
  position: string;
  matchOverall: number;
  form: number;
}

interface PlayerPerformance {
  playerId: number;
  minutes: number;
  points: number;
  twoPtMade: number;
  twoPtAtt: number;
  threePtMade: number;
  threePtAtt: number;
  ftMade: number;
  ftAtt: number;
  dunks: number;
  oreb: number;
  dreb: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  stl: number;
  blk: number;
  fouls: number;
  plusMinus: number;
  performanceRating: number;
  fgm: number;
  fga: number;
}

type TeamTactics = {
  pace?: "slow" | "balanced" | "fast";
  threePtFocus?: number; // 0..100
  defenseScheme?: "drop" | "switch" | "press";
};

type SimOptions = {
  homeTactics?: TeamTactics;
  awayTactics?: TeamTactics;
  homeTeamForm?: number;
  awayTeamForm?: number;
};

export function simulateGame(
  homePlayers: SimPlayerInput[],
  awayPlayers: SimPlayerInput[],
  homeTeamRating: number,
  awayTeamRating: number,
  options: SimOptions = {}
): { homeScore: number; awayScore: number; homeStats: PlayerPerformance[]; awayStats: PlayerPerformance[] } {
  const homeAdvantage = 5;
  const ratingDiff = homeTeamRating - awayTeamRating;
  const homePace = getPaceModifier(options.homeTactics?.pace);
  const awayPace = getPaceModifier(options.awayTactics?.pace);
  const paceFactor = (homePace + awayPace) / 2;

  const basePossessions = 95;
  const possessions = Math.max(85, Math.min(110, Math.round(basePossessions * paceFactor + randomInRange(-4, 4))));

  const homeOffenseBoost = (options.homeTactics?.threePtFocus ?? 50) / 100;
  const awayOffenseBoost = (options.awayTactics?.threePtFocus ?? 50) / 100;

  const homeDefensePenalty = getDefensePenalty(options.awayTactics?.defenseScheme) + getFormDefensePenalty(options.awayTeamForm);
  const awayDefensePenalty = getDefensePenalty(options.homeTactics?.defenseScheme) + getFormDefensePenalty(options.homeTeamForm);
  const homeFormBoost = getTeamFormBoost(options.homeTeamForm);
  const awayFormBoost = getTeamFormBoost(options.awayTeamForm);

  const homeEfficiency = 1.04 + (homeTeamRating - 75) * 0.006 + homeOffenseBoost * 0.05 + homeFormBoost - homeDefensePenalty;
  const awayEfficiency = 1.02 + (awayTeamRating - 75) * 0.006 + awayOffenseBoost * 0.05 + awayFormBoost - awayDefensePenalty;

  let homeScore = Math.floor(possessions * homeEfficiency + homeAdvantage + ratingDiff * 0.3 + randomInRange(-8, 8));
  let awayScore = Math.floor(possessions * awayEfficiency - ratingDiff * 0.3 + randomInRange(-8, 8));

  if (homeScore === awayScore) {
    homeScore += 1;
  }
  homeScore = Math.max(50, Math.min(150, homeScore));
  awayScore = Math.max(50, Math.min(150, awayScore));

  const homeStats = buildStats(homePlayers, homeScore, paceFactor);
  const awayStats = buildStats(awayPlayers, awayScore, paceFactor);

  return { homeScore, awayScore, homeStats, awayStats };
}

export function getTeamRating(players: SimPlayerInput[], teamForm = 50): number {
  if (players.length === 0) return 70;
  const sorted = [...players]
    .sort((a, b) => b.matchOverall - a.matchOverall)
    .slice(0, 10);
  const avgOverall = sorted.reduce((sum, p) => sum + p.matchOverall, 0) / sorted.length;
  const formFactor = 1 + ((Math.max(0, Math.min(100, teamForm)) - 50) / 50) * 0.05;
  return Math.round(Math.min(99, Math.max(50, avgOverall * formFactor)));
}

function getPaceModifier(pace: TeamTactics["pace"]): number {
  if (pace === "fast") return 1.06;
  if (pace === "slow") return 0.94;
  return 1.0;
}

function getDefensePenalty(scheme: TeamTactics["defenseScheme"]): number {
  if (scheme === "switch") return 0.02;
  if (scheme === "press") return 0.01;
  return 0;
}

function getTeamFormBoost(form = 50): number {
  const bounded = Math.max(0, Math.min(100, form));
  return (bounded - 50) * 0.0009;
}

function getFormDefensePenalty(opponentForm = 50): number {
  const bounded = Math.max(0, Math.min(100, opponentForm));
  return (bounded - 50) * 0.0004;
}

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function buildStats(players: SimPlayerInput[], teamScore: number, paceFactor: number): PlayerPerformance[] {
  if (players.length === 0) return [];
  const paceMinutes = Math.max(0.9, Math.min(1.1, paceFactor));
  const rawWeights = players.map((player, idx) => {
    const positionBoost = getPositionUsageBoost(player.position);
    const talentBoost = Math.max(0.7, Math.min(1.4, player.matchOverall / 75));
    const formBoost = 0.9 + Math.max(0, Math.min(100, player.form)) / 200;
    if (idx < 5) return (1.0 - idx * 0.08) * positionBoost * talentBoost * formBoost;
    const benchBase = 0.45 - (idx - 5) * 0.05;
    return Math.max(0.08, benchBase * positionBoost * talentBoost * formBoost);
  });

  const weightSum = rawWeights.reduce((a, b) => a + b, 0);
  const stats = players.map((player, idx) => {
    const share = Math.max(0.02, rawWeights[idx] / weightSum);
    const minutes = Math.max(6, Math.min(40, Math.round((share * 230) * paceMinutes)));
    const efficiency = Math.max(0.36, Math.min(0.68, 0.46 + (player.matchOverall - 70) * 0.003));
    const shotVolume = Math.max(3, Math.round(share * 82 + randomInRange(-2, 3)));
    const fga = Math.max(1, shotVolume);
    const fgm = Math.max(0, Math.min(fga, Math.round(fga * efficiency)));
    const points = Math.max(0, Math.round(teamScore * share + randomInRange(-3, 4)));
    const rebounds = Math.max(0, Math.round(2 + share * 18 + getReboundBias(player.position) + randomInRange(-2, 2)));
    const assists = Math.max(0, Math.round(1 + share * 14 + getAssistBias(player.position) + randomInRange(-2, 2)));
    const turnovers = Math.max(0, Math.round(0.8 + share * 6 + randomInRange(-1, 1)));
    const stl = Math.max(0, Math.round(share * 2.6 + randomInRange(-1, 1)));
    const blk = Math.max(0, Math.round(share * 2.2 + getReboundBias(player.position) * 0.4 + randomInRange(-1, 1)));
    const oreb = Math.max(0, Math.min(rebounds, Math.round(rebounds * (0.18 + Math.max(0, getReboundBias(player.position)) * 0.05) + randomInRange(-1, 1))));
    const dreb = Math.max(0, rebounds - oreb);

    // Derive shot profile and make splits roughly consistent with points and FGM/FGA.
    const threePtAttRate = getThreePointAttemptRate(player.position);
    const threePtAtt = Math.max(0, Math.min(fga, Math.round(fga * threePtAttRate + randomInRange(-1, 2))));
    const twoPtAtt = Math.max(0, fga - threePtAtt);
    const threePtPct = Math.max(0.22, Math.min(0.47, 0.31 + (player.matchOverall - 70) * 0.002 + randomInRange(-0.05, 0.05)));
    let threePtMade = Math.max(0, Math.min(threePtAtt, Math.round(threePtAtt * threePtPct)));
    let twoPtMade = Math.max(0, Math.min(twoPtAtt, fgm - threePtMade));
    if ((twoPtMade + threePtMade) > fgm) {
      const overflow = (twoPtMade + threePtMade) - fgm;
      twoPtMade = Math.max(0, twoPtMade - overflow);
    } else if ((twoPtMade + threePtMade) < fgm) {
      twoPtMade = Math.min(twoPtAtt, twoPtMade + (fgm - (twoPtMade + threePtMade)));
    }

    const shootingPoints = (twoPtMade * 2) + (threePtMade * 3);
    const remainingPoints = Math.max(0, points - shootingPoints);
    const ftMade = Math.max(0, Math.round(Math.min(remainingPoints, 14)));
    const ftAtt = Math.max(ftMade, Math.round(ftMade * (1.1 + randomInRange(0, 0.5))));
    const dunks = Math.max(0, Math.min(twoPtMade, Math.round(twoPtMade * getDunkRate(player.position) + randomInRange(-1, 1))));
    const fouls = Math.max(0, Math.round(1 + share * 5 + randomInRange(-1, 1)));
    const plusMinus = Math.round((share - (1 / Math.max(players.length, 1))) * 40 + (player.matchOverall - 75) * 0.3 + randomInRange(-6, 6));
    const missedShotsPenalty = Math.max(0, (twoPtAtt - twoPtMade) + (threePtAtt - threePtMade) + (ftAtt - ftMade));
    const performanceRating = computePerformanceRating({
      points,
      rebounds,
      assists,
      steals: stl,
      blocks: blk,
      turnovers,
      missedShots: missedShotsPenalty,
    });
    return {
      playerId: player.playerId,
      minutes,
      points,
      twoPtMade,
      twoPtAtt,
      threePtMade,
      threePtAtt,
      ftMade,
      ftAtt,
      dunks,
      oreb,
      dreb,
      rebounds,
      assists,
      turnovers,
      stl,
      blk,
      fouls,
      plusMinus,
      performanceRating,
      fgm,
      fga,
    };
  });
  normalizeTeamPoints(stats, teamScore);
  return stats;
}

function getPositionUsageBoost(position: string): number {
  const p = String(position ?? "").toUpperCase();
  if (p.includes("PG") || p.includes("SG") || p === "G") return 1.1;
  if (p.includes("C")) return 0.95;
  return 1.0;
}

function getReboundBias(position: string): number {
  const p = String(position ?? "").toUpperCase();
  if (p.includes("C") || p.includes("PF")) return 1.5;
  if (p.includes("PG")) return -0.5;
  return 0;
}

function getAssistBias(position: string): number {
  const p = String(position ?? "").toUpperCase();
  if (p.includes("PG")) return 1.8;
  if (p.includes("C")) return -0.5;
  return 0.3;
}

function getThreePointAttemptRate(position: string): number {
  const p = String(position ?? "").toUpperCase();
  if (p.includes("PG") || p.includes("SG")) return 0.42;
  if (p.includes("SF")) return 0.34;
  if (p.includes("PF")) return 0.24;
  if (p.includes("C")) return 0.12;
  return 0.3;
}

function getDunkRate(position: string): number {
  const p = String(position ?? "").toUpperCase();
  if (p.includes("C")) return 0.35;
  if (p.includes("PF")) return 0.28;
  if (p.includes("SF")) return 0.18;
  return 0.08;
}

function computePerformanceRating(input: {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  missedShots: number;
}): number {
  // Documented formula reused across result screens:
  // (PTS + 1.2*REB + 1.5*AST + 2*STL + 2*BLK) - (2*TOV + 0.7*missed shots)
  const score =
    input.points +
    input.rebounds * 1.2 +
    input.assists * 1.5 +
    input.steals * 2 +
    input.blocks * 2 -
    input.turnovers * 2 -
    input.missedShots * 0.7;
  return Math.round(score * 10) / 10;
}

function normalizeTeamPoints(stats: PlayerPerformance[], targetPoints: number) {
  if (!stats.length) return;
  let sum = stats.reduce((acc, s) => acc + s.points, 0);
  let delta = targetPoints - sum;
  if (delta === 0) return;

  const ordered = [...stats].sort((a, b) => b.points - a.points);
  let guard = 0;
  while (delta !== 0 && guard < 2000) {
    guard += 1;
    for (const s of ordered) {
      if (delta === 0) break;
      if (delta > 0) {
        s.points += 1;
        delta -= 1;
        continue;
      }
      // For negative adjustment, do not drop below 0.
      if (s.points <= 0) continue;
      s.points -= 1;
      delta += 1;
    }
    // If all players are at zero and delta still negative (should not happen), stop.
    if (delta < 0 && ordered.every((s) => s.points <= 0)) break;
  }

  // Recompute performance rating with updated points (other fields unchanged).
  for (const s of stats) {
    const missedShotsPenalty =
      Math.max(0, (s.twoPtAtt - s.twoPtMade) + (s.threePtAtt - s.threePtMade) + (s.ftAtt - s.ftMade));
    s.performanceRating = computePerformanceRating({
      points: s.points,
      rebounds: s.rebounds,
      assists: s.assists,
      steals: s.stl,
      blocks: s.blk,
      turnovers: s.turnovers,
      missedShots: missedShotsPenalty,
    });
  }
}

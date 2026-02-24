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
  rebounds: number;
  assists: number;
  turnovers: number;
  stl: number;
  blk: number;
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
  return players.map((player, idx) => {
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
    return {
      playerId: player.playerId,
      minutes,
      points,
      rebounds,
      assists,
      turnovers,
      stl,
      blk,
      fgm,
      fga,
    };
  });
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

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export const DEFAULT_TACTICS = {
  fullCourtPress: false,
  defenseMode: 'man',
  crashBoards: false,
  transitionPush: true,
  slowPace: false,
  isoPlays: false,
  feedPost: false,
  benchRotation: false,
  autoCoach: true,
  pointsOfEmphasis: {
    protectPaint: false,
    limitTurnovers: false,
    attackMismatch: false,
    runAfterRebound: true,
  },
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60);
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function quarterLabel(quarter) {
  if (quarter <= 4) return `Q${quarter}`;
  return `OT${quarter - 4}`;
}

export function getTeamCoreRating(team) {
  const attack = Number(team?.offensiveRating ?? team?.overallRating ?? 75);
  const defense = Number(team?.defensiveRating ?? team?.overallRating ?? 75);
  return {
    offense: clamp(attack, 55, 99),
    defense: clamp(defense, 55, 99),
  };
}

function normalizePos(pos) {
  const raw = String(pos || '').toUpperCase();
  if (raw.includes('PG')) return 'PG';
  if (raw.includes('SG')) return 'SG';
  if (raw.includes('SF')) return 'SF';
  if (raw.includes('PF')) return 'PF';
  if (raw.includes('C')) return 'C';
  if (raw.includes('G')) return 'SG';
  if (raw.includes('F')) return 'SF';
  return 'SG';
}

function ovr(player) {
  return Number(player?.overall ?? player?.rating ?? player?.attributes?.overall ?? 65);
}

function makeFallbackPlayer(teamShort, pos, index) {
  return {
    id: `${teamShort}-${pos}-${index}`,
    name: `${teamShort} ${pos}${index}`,
    position: pos,
    overall: 65 + index,
    stamina: 78 - index,
  };
}

export function getLineupByPosition(players, fallbackTag) {
  const buckets = new Map(POSITIONS.map((p) => [p, []]));
  for (const player of players || []) {
    const pos = normalizePos(player.position);
    buckets.get(pos).push(player);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => ovr(b) - ovr(a));
  }
  const used = new Set();
  const lineup = {};
  for (const pos of POSITIONS) {
    const direct = (buckets.get(pos) || []).find((p) => !used.has(p.id));
    if (direct) {
      used.add(direct.id);
      lineup[pos] = direct;
      continue;
    }
    const flexPool = ['PG', 'SG', 'SF', 'PF', 'C']
      .flatMap((p) => buckets.get(p) || [])
      .find((p) => !used.has(p.id));
    if (flexPool) {
      used.add(flexPool.id);
      lineup[pos] = flexPool;
    } else {
      lineup[pos] = makeFallbackPlayer(fallbackTag, pos, 1);
    }
  }
  return lineup;
}

function getTacticModifiers(tactics) {
  const pace = (tactics.slowPace ? -0.16 : 0) + (tactics.transitionPush ? 0.12 : 0) + (tactics.fullCourtPress ? 0.09 : 0);
  const steal = (tactics.fullCourtPress ? 0.06 : 0) + (tactics.defenseMode === 'zone' ? 0.02 : 0);
  const foulRisk = (tactics.fullCourtPress ? 0.05 : 0) + (tactics.crashBoards ? 0.02 : 0);
  const turnover = (tactics.isoPlays ? 0.03 : 0) + (tactics.pointsOfEmphasis.limitTurnovers ? -0.05 : 0);
  const paint = (tactics.feedPost ? 0.08 : 0) + (tactics.pointsOfEmphasis.protectPaint ? -0.06 : 0);
  const rebounding = (tactics.crashBoards ? 0.1 : 0) + (tactics.benchRotation ? -0.03 : 0);
  const fatigue = (tactics.fullCourtPress ? 0.08 : 0) + (tactics.transitionPush ? 0.04 : 0) + (tactics.slowPace ? -0.04 : 0);
  return { pace, steal, foulRisk, turnover, paint, rebounding, fatigue };
}

function pickScorer(lineup, tactics, seed) {
  const list = Object.entries(lineup || {});
  if (list.length === 0) return null;
  const weightByPos = { PG: 1.0, SG: 1.1, SF: 1.0, PF: 0.9, C: 0.9 };
  const isoBoost = tactics.isoPlays ? { PG: 0.3, SG: 0.25, SF: 0.15, PF: 0.1, C: 0.06 } : {};
  const postBoost = tactics.feedPost ? { C: 0.35, PF: 0.2, SF: 0.08 } : {};
  const roll = Math.abs(Math.sin(seed * 14.27)) % 1;
  let total = 0;
  const weighted = list.map(([pos, player]) => {
    const base = weightByPos[pos] || 1;
    const boost = (isoBoost[pos] || 0) + (postBoost[pos] || 0);
    const value = Math.max(0.1, base + boost + (ovr(player) - 70) / 100);
    total += value;
    return { player, pos, value };
  });
  let running = 0;
  for (const row of weighted) {
    running += row.value / total;
    if (roll <= running) return { ...row.player, pos: row.pos };
  }
  return { ...weighted[0].player, pos: weighted[0].pos };
}

export function buildAdvice({
  homeTactics,
  awayTactics,
  homeStats,
  awayStats,
  possessionSide,
  homeTeam,
  awayTeam,
}) {
  const notes = [];
  if ((awayStats?.paintPoints || 0) - (homeStats?.paintPoints || 0) >= 8) {
    notes.push('Opponent is attacking the paint. Consider zone or help rotations.');
  }
  if ((homeStats?.reb || 0) + 4 < (awayStats?.reb || 0)) {
    notes.push('Our bench unit is losing the rebound battle. Crash boards may help.');
  }
  if ((awayStats?.run || 0) >= 8) {
    notes.push(`Their run is building (${awayStats.run}-0). Use timeout or slow pace.`);
  }
  if (homeTactics.fullCourtPress) {
    notes.push('Full Court Press is active: higher steals, but fatigue and fouls increase.');
  }
  if (homeTactics.slowPace) {
    notes.push('Tempo is slower. Late-clock possessions will reduce variance.');
  }
  if (homeTactics.isoPlays) {
    notes.push('Iso Plays active. Star usage is up, turnover risk also rises.');
  }
  if (possessionSide === 'away') {
    notes.push(`${awayTeam?.shortName || 'Opponent'} has possession. Force them into perimeter shots.`);
  }
  if (awayTactics.feedPost) {
    notes.push('Opponent keeps feeding the post. Protect paint and avoid foul trouble.');
  }
  return notes.slice(0, 4);
}

function defaultTeamStats() {
  return {
    pts: 0,
    fgMade: 0,
    fgAtt: 0,
    threeMade: 0,
    threeAtt: 0,
    ftMade: 0,
    ftAtt: 0,
    ast: 0,
    reb: 0,
    tov: 0,
    stl: 0,
    teamFouls: 0,
    timeouts: 7,
    paintPoints: 0,
    run: 0,
  };
}

function initialPlayerStats(lineup) {
  const rows = {};
  for (const player of Object.values(lineup || {})) {
    rows[player.id] = {
      playerId: player.id,
      name: player.name,
      position: player.position,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      turnovers: 0,
      fgm: 0,
      fga: 0,
      tpm: 0,
      tpa: 0,
      ftm: 0,
      fta: 0,
      minutes: 0,
      stamina: Number(player.stamina ?? 85),
      fouls: 0,
    };
  }
  return rows;
}

export function buildInitialMatchState({ homeLineup, awayLineup }) {
  return {
    quarter: 1,
    gameClockSeconds: 12 * 60,
    shotClock: 24,
    possessionSide: 'home',
    homeScore: 0,
    awayScore: 0,
    quarterScores: {
      home: [0, 0, 0, 0, 0],
      away: [0, 0, 0, 0, 0],
    },
    homeStats: defaultTeamStats(),
    awayStats: defaultTeamStats(),
    homePlayers: initialPlayerStats(homeLineup),
    awayPlayers: initialPlayerStats(awayLineup),
    eventCounter: 1,
    isFinal: false,
  };
}

function updateMinutes(playerStats, seconds) {
  for (const stats of Object.values(playerStats)) {
    stats.minutes = Number((stats.minutes + (seconds / 60)).toFixed(1));
  }
}

export function simulatePossession({
  state,
  homeTeam,
  awayTeam,
  homeLineup,
  awayLineup,
  homeTactics,
  awayTactics,
  timeSpentOverride,
  preserveClock = false,
}) {
  const offenseSide = state.possessionSide;
  const defenseSide = offenseSide === 'home' ? 'away' : 'home';
  const offenseTeam = offenseSide === 'home' ? homeTeam : awayTeam;
  const defenseTeam = offenseSide === 'home' ? awayTeam : homeTeam;
  const offenseLineup = offenseSide === 'home' ? homeLineup : awayLineup;
  const offenseStats = offenseSide === 'home' ? state.homeStats : state.awayStats;
  const defenseStats = defenseSide === 'home' ? state.homeStats : state.awayStats;
  const offensePlayers = offenseSide === 'home' ? state.homePlayers : state.awayPlayers;
  const defensePlayers = defenseSide === 'home' ? state.homePlayers : state.awayPlayers;
  const offenseTactics = offenseSide === 'home' ? homeTactics : awayTactics;
  const defenseTactics = defenseSide === 'home' ? homeTactics : awayTactics;

  const offenseMod = getTacticModifiers(offenseTactics);
  const defenseMod = getTacticModifiers(defenseTactics);
  const offenseRating = getTeamCoreRating(offenseTeam).offense + (offenseMod.paint * 22);
  const defenseRating = getTeamCoreRating(defenseTeam).defense + (defenseMod.paint * 25);
  const qualityDelta = (offenseRating - defenseRating) / 100;

  const seed = state.eventCounter * 17.37 + state.quarter * 11.1 + state.gameClockSeconds;
  const rng = Math.abs(Math.sin(seed)) % 1;
  const pace = clamp(0.5 + offenseMod.pace - defenseMod.pace, 0.33, 0.74);
  const computedTime = Math.round(11 + (1 - pace) * 10 + rng * 5);
  const timeSpent = Number.isFinite(timeSpentOverride) && timeSpentOverride > 0
    ? Math.round(timeSpentOverride)
    : computedTime;
  const newClock = preserveClock
    ? Math.max(0, state.gameClockSeconds)
    : Math.max(0, state.gameClockSeconds - timeSpent);
  updateMinutes(state.homePlayers, timeSpent);
  updateMinutes(state.awayPlayers, timeSpent);

  const scorer = pickScorer(offenseLineup, offenseTactics, seed);
  const scorerStats = scorer ? offensePlayers[scorer.id] : null;
  const supportSeed = Math.abs(Math.sin(seed * 0.77)) % 1;

  const turnoverChance = clamp(0.11 + offenseMod.turnover + defenseMod.steal - qualityDelta * 0.05, 0.05, 0.25);
  const foulChance = clamp(0.08 + offenseMod.foulRisk + defenseMod.foulRisk, 0.03, 0.24);
  const threeShare = clamp(0.31 + (offenseTactics.isoPlays ? -0.06 : 0) + (offenseTactics.slowPace ? 0.04 : 0), 0.18, 0.52);
  const makeThreeChance = clamp(0.34 + qualityDelta * 0.24, 0.2, 0.54);
  const makeTwoChance = clamp(0.49 + qualityDelta * 0.25 + offenseMod.paint * 0.18, 0.31, 0.72);

  let text = '';
  let points = 0;
  let isTurnover = false;
  let isAssist = false;
  let ballHandler = scorer?.id ?? null;

  if (rng < turnoverChance) {
    offenseStats.tov += 1;
    defenseStats.stl += supportSeed > 0.45 ? 1 : 0;
    if (scorerStats) scorerStats.turnovers += 1;
    text = `${offenseTeam.shortName} turnover. ${defenseTeam.shortName} gets a stop.`;
    isTurnover = true;
  } else if (rng < turnoverChance + foulChance) {
    offenseStats.ftAtt += 2;
    offenseStats.ftMade += supportSeed > 0.27 ? 2 : 1;
    points = supportSeed > 0.27 ? 2 : 1;
    if (scorerStats) {
      scorerStats.fta += 2;
      scorerStats.ftm += points;
      scorerStats.points += points;
    }
    defenseStats.teamFouls += 1;
    text = `${scorer?.name || offenseTeam.shortName} draws contact and hits ${points}/2 FT.`;
  } else {
    const isThree = supportSeed < threeShare;
    if (isThree) {
      offenseStats.fgAtt += 1;
      offenseStats.threeAtt += 1;
      if (scorerStats) {
        scorerStats.fga += 1;
        scorerStats.tpa += 1;
      }
      if (Math.abs(Math.sin(seed * 1.29)) % 1 < makeThreeChance) {
        points = 3;
        offenseStats.fgMade += 1;
        offenseStats.threeMade += 1;
        if (scorerStats) {
          scorerStats.fgm += 1;
          scorerStats.tpm += 1;
          scorerStats.points += 3;
        }
        text = `${scorer?.name || offenseTeam.shortName} drills a three.`;
      } else {
        text = `${scorer?.name || offenseTeam.shortName} misses from deep.`;
      }
    } else {
      offenseStats.fgAtt += 1;
      if (scorerStats) scorerStats.fga += 1;
      if (Math.abs(Math.sin(seed * 1.61)) % 1 < makeTwoChance) {
        points = 2;
        offenseStats.fgMade += 1;
        offenseStats.paintPoints += offenseTactics.feedPost ? 2 : 1;
        if (scorerStats) {
          scorerStats.fgm += 1;
          scorerStats.points += 2;
        }
        text = `${scorer?.name || offenseTeam.shortName} finishes inside.`;
      } else {
        text = `${scorer?.name || offenseTeam.shortName} misses a mid-range look.`;
      }
    }
  }

  if (points > 0) {
    const assistChance = clamp(0.56 + (offenseTactics.isoPlays ? -0.22 : 0), 0.15, 0.8);
    if ((Math.abs(Math.sin(seed * 1.9)) % 1) < assistChance) {
      offenseStats.ast += 1;
      const assister = Object.values(offensePlayers).find((row) => row.playerId !== scorer?.id);
      if (assister) assister.assists += 1;
      isAssist = true;
    }
    offenseStats.pts += points;
    offenseStats.run += points;
    defenseStats.run = 0;
    if (offenseSide === 'home') {
      state.homeScore += points;
      state.quarterScores.home[state.quarter - 1] += points;
    } else {
      state.awayScore += points;
      state.quarterScores.away[state.quarter - 1] += points;
    }
  } else if (!isTurnover) {
    const offenseRebChance = clamp(0.22 + offenseMod.rebounding - defenseMod.rebounding, 0.1, 0.5);
    if ((Math.abs(Math.sin(seed * 2.11)) % 1) < offenseRebChance) {
      offenseStats.reb += 1;
      const rebMan = Object.values(offensePlayers).find((row) => row.position?.includes('F') || row.position?.includes('C'));
      if (rebMan) rebMan.rebounds += 1;
      text += ' Offensive rebound extends the possession.';
      state.shotClock = 14;
      state.gameClockSeconds = newClock;
      state.eventCounter += 1;
      return {
        ...state,
        activePlayerId: ballHandler,
        recentEvent: {
          id: `ev-${state.eventCounter}`,
          quarter: state.quarter,
          clock: formatClock(newClock),
          text,
          offenseSide,
          points: 0,
          possessionResult: 'off_reb',
          isAssist,
        },
      };
    }
  }

  defenseStats.reb += points === 0 && !isTurnover ? 1 : 0;
  state.shotClock = 24;
  state.gameClockSeconds = newClock;
  state.possessionSide = defenseSide;
  state.eventCounter += 1;

  return {
    ...state,
    activePlayerId: ballHandler,
    recentEvent: {
      id: `ev-${state.eventCounter}`,
      quarter: state.quarter,
      clock: formatClock(newClock),
      text,
      offenseSide,
      points,
      possessionResult: isTurnover ? 'turnover' : (points > 0 ? 'score' : 'miss'),
      isAssist,
    },
  };
}

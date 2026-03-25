import { formatClock, getTeamCoreRating } from './matchSimUtils.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seedInput) {
  const str = String(seedInput ?? '42');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFromLineup(lineup, role, rng) {
  const rows = Object.values(lineup || {});
  if (!rows.length) return null;
  const weighted = rows.map((p) => {
    const ovr = Number(p?.overall ?? p?.overallCurrent ?? 70);
    let w = 1 + ((ovr - 65) / 40);
    if (role === 'iso' && String(p.position || '').includes('G')) w += 0.25;
    if (role === 'post' && (String(p.position || '').includes('C') || String(p.position || '').includes('PF'))) w += 0.3;
    return { p, w: Math.max(0.1, w) };
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let roll = rng() * total;
  for (const row of weighted) {
    roll -= row.w;
    if (roll <= 0) return row.p;
  }
  return weighted[0].p;
}

function initPlayerRows(lineup) {
  const out = {};
  Object.values(lineup || {}).forEach((p) => {
    out[p.id] = {
      playerId: p.id,
      name: p.name,
      position: p.position || '',
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
      fouls: 0,
      minutes: 0,
    };
  });
  return out;
}

function emptyTeamStats() {
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
    run: 0,
  };
}

function getPossessionSeconds(state, tactics) {
  const paceAdj = tactics?.slowPace ? 3 : (tactics?.transitionPush ? -2 : 0);
  const base = 14 + Math.floor(state.rng() * 7);
  return clamp(base + paceAdj, 8, 24);
}

function eventId(state) {
  return `ev-${state.eventCounter + 1}`;
}

function addPoints(state, side, points, quarterIndex) {
  if (points <= 0) return;
  if (side === 'home') {
    state.homeScore += points;
    state.quarterScores.home[quarterIndex] += points;
    state.homeStats.pts += points;
    state.homeStats.run += points;
    state.awayStats.run = 0;
  } else {
    state.awayScore += points;
    state.quarterScores.away[quarterIndex] += points;
    state.awayStats.pts += points;
    state.awayStats.run += points;
    state.homeStats.run = 0;
  }
}

function incPlayerMinutes(players, seconds) {
  Object.values(players).forEach((row) => {
    row.minutes = Number((Number(row.minutes || 0) + (seconds / 60)).toFixed(1));
  });
}

function validateConsistency(state) {
  const qHome = state.quarterScores.home.reduce((s, x) => s + Number(x || 0), 0);
  const qAway = state.quarterScores.away.reduce((s, x) => s + Number(x || 0), 0);
  const pHome = state.playByPlay.reduce((s, e) => s + (e.team === 'home' ? Number(e.pointsDelta || 0) : 0), 0);
  const pAway = state.playByPlay.reduce((s, e) => s + (e.team === 'away' ? Number(e.pointsDelta || 0) : 0), 0);
  const issues = [];
  if (qHome !== state.homeScore) issues.push(`home quarter sum ${qHome} != home score ${state.homeScore}`);
  if (qAway !== state.awayScore) issues.push(`away quarter sum ${qAway} != away score ${state.awayScore}`);
  if (pHome !== state.homeScore) issues.push(`home pbp sum ${pHome} != home score ${state.homeScore}`);
  if (pAway !== state.awayScore) issues.push(`away pbp sum ${pAway} != away score ${state.awayScore}`);
  if (state.gameClockSeconds < 0) issues.push('game clock below zero');
  if (state.quarter < 1 || state.quarter > 5) issues.push(`invalid quarter ${state.quarter}`);
  const duplicateIds = new Set();
  for (const e of state.playByPlay) {
    if (duplicateIds.has(e.id)) issues.push(`duplicate event id ${e.id}`);
    duplicateIds.add(e.id);
  }
  if (issues.length && state.debug) {
    throw new Error(`Match consistency error: ${issues.join(' | ')}`);
  }
  return issues;
}

export function createMatchState({
  seed,
  homeLineup,
  awayLineup,
  debug = false,
}) {
  const rng = mulberry32(hashSeed(seed));
  const state = {
    homeScore: 0,
    awayScore: 0,
    quarter: 1,
    gameClockSeconds: 12 * 60,
    shotClock: 24,
    possession: 'home',
    quarterScores: { home: [0, 0, 0, 0, 0], away: [0, 0, 0, 0, 0] },
    playByPlay: [],
    homePlayers: initPlayerRows(homeLineup),
    awayPlayers: initPlayerRows(awayLineup),
    homeStats: emptyTeamStats(),
    awayStats: emptyTeamStats(),
    momentum: 50,
    status: 'pregame',
    possessionElapsed: 0,
    possessionTarget: 14,
    eventCounter: 0,
    isFinal: false,
    rng,
    debug,
  };
  state.possessionTarget = getPossessionSeconds(state, {});
  return state;
}

function transitionQuarter(state) {
  if (state.quarter < 4) {
    state.quarter += 1;
    state.gameClockSeconds = 12 * 60;
    state.shotClock = 24;
    state.possessionElapsed = 0;
    state.possessionTarget = getPossessionSeconds(state, {});
    state.status = state.quarter === 3 ? 'halftime' : 'live';
    return state;
  }
  if (state.quarter === 4 && state.homeScore === state.awayScore) {
    state.quarter = 5;
    state.gameClockSeconds = 5 * 60;
    state.shotClock = 24;
    state.possessionElapsed = 0;
    state.possessionTarget = getPossessionSeconds(state, {});
    state.status = 'overtime';
    return state;
  }
  state.isFinal = true;
  state.status = 'finished';
  state.gameClockSeconds = 0;
  state.shotClock = 0;
  return state;
}

export function resolvePossession(state, ctx) {
  if (state.isFinal) return state;
  const quarterIndex = Math.max(0, Math.min(4, state.quarter - 1));
  const offenseSide = state.possession;
  const defenseSide = offenseSide === 'home' ? 'away' : 'home';
  const offenseLineup = offenseSide === 'home' ? ctx.homeLineup : ctx.awayLineup;
  const offensePlayers = offenseSide === 'home' ? state.homePlayers : state.awayPlayers;
  const offenseStats = offenseSide === 'home' ? state.homeStats : state.awayStats;
  const defenseStats = defenseSide === 'home' ? state.homeStats : state.awayStats;
  const offenseTeam = offenseSide === 'home' ? ctx.homeTeam : ctx.awayTeam;
  const defenseTeam = offenseSide === 'home' ? ctx.awayTeam : ctx.homeTeam;

  incPlayerMinutes(state.homePlayers, Math.max(1, state.possessionElapsed));
  incPlayerMinutes(state.awayPlayers, Math.max(1, state.possessionElapsed));

  const offenseRating = getTeamCoreRating(offenseTeam).offense;
  const defenseRating = getTeamCoreRating(defenseTeam).defense;
  const quality = clamp((offenseRating - defenseRating) / 100, -0.25, 0.25);
  const turnoverChance = clamp(0.11 - quality * 0.04, 0.06, 0.2);
  const foulChance = clamp(0.09 + (ctx.tactics?.fullCourtPress ? 0.03 : 0), 0.05, 0.2);
  const threeShare = clamp(0.36 + (ctx.tactics?.slowPace ? -0.03 : 0), 0.24, 0.48);
  const threeMake = clamp(0.35 + quality * 0.15, 0.24, 0.48);
  const twoMake = clamp(0.5 + quality * 0.15, 0.35, 0.63);

  const role = ctx.tactics?.isoPlays ? 'iso' : (ctx.tactics?.feedPost ? 'post' : 'balanced');
  const scorer = pickFromLineup(offenseLineup, role, state.rng);
  const scorerRow = scorer ? offensePlayers[scorer.id] : null;

  let pointsDelta = 0;
  let eventType = 'miss';
  let text = '';
  let assistId = null;

  const roll = state.rng();
  if (roll < turnoverChance) {
    eventType = 'turnover';
    offenseStats.tov += 1;
    defenseStats.stl += 1;
    if (scorerRow) scorerRow.turnovers += 1;
    text = `Turnover by ${scorer?.name || offenseTeam?.shortName || 'offense'}`;
  } else if (roll < turnoverChance + foulChance) {
    eventType = 'free_throw';
    const made = state.rng() < 0.72 ? 2 : 1;
    pointsDelta = made;
    offenseStats.ftAtt += 2;
    offenseStats.ftMade += made;
    defenseStats.teamFouls += 1;
    if (scorerRow) {
      scorerRow.fta += 2;
      scorerRow.ftm += made;
      scorerRow.points += made;
    }
    text = `${scorer?.name || 'Player'} makes ${made} of 2 free throws`;
  } else {
    const isThree = state.rng() < threeShare;
    if (isThree) {
      offenseStats.fgAtt += 1;
      offenseStats.threeAtt += 1;
      if (scorerRow) {
        scorerRow.fga += 1;
        scorerRow.tpa += 1;
      }
      if (state.rng() < threeMake) {
        pointsDelta = 3;
        eventType = 'made_3pt';
        offenseStats.fgMade += 1;
        offenseStats.threeMade += 1;
        if (scorerRow) {
          scorerRow.fgm += 1;
          scorerRow.tpm += 1;
          scorerRow.points += 3;
        }
        text = `${scorer?.name || 'Player'} makes a 3PT shot`;
      } else {
        text = `${scorer?.name || 'Player'} misses a 3PT shot`;
      }
    } else {
      offenseStats.fgAtt += 1;
      if (scorerRow) scorerRow.fga += 1;
      if (state.rng() < twoMake) {
        pointsDelta = 2;
        eventType = 'made_2pt';
        offenseStats.fgMade += 1;
        if (scorerRow) {
          scorerRow.fgm += 1;
          scorerRow.points += 2;
        }
        text = `${scorer?.name || 'Player'} scores on a 2PT shot`;
      } else {
        text = `${scorer?.name || 'Player'} misses a 2PT shot`;
      }
    }
  }

  if (pointsDelta > 0) {
    const assistChance = clamp(0.58 - (ctx.tactics?.isoPlays ? 0.18 : 0), 0.2, 0.75);
    if (state.rng() < assistChance) {
      const assister = pickFromLineup(offenseLineup, 'balanced', state.rng);
      if (assister && assister.id !== scorer?.id && offensePlayers[assister.id]) {
        offensePlayers[assister.id].assists += 1;
        offenseStats.ast += 1;
        assistId = assister.id;
      }
    }
    addPoints(state, offenseSide, pointsDelta, quarterIndex);
  } else if (eventType !== 'turnover') {
    defenseStats.reb += 1;
    const rebGuy = pickFromLineup(offenseSide === 'home' ? ctx.awayLineup : ctx.homeLineup, 'balanced', state.rng);
    const rebounders = offenseSide === 'home' ? state.awayPlayers : state.homePlayers;
    if (rebGuy && rebounders[rebGuy.id]) rebounders[rebGuy.id].rebounds += 1;
  }

  state.eventCounter += 1;
  const event = {
    id: eventId(state),
    quarter: `Q${state.quarter <= 4 ? state.quarter : `OT${state.quarter - 4}`}`,
    gameClock: formatClock(state.gameClockSeconds),
    team: offenseSide,
    playerId: scorer?.id ?? null,
    playerName: scorer?.name ?? null,
    assistPlayerId: assistId,
    eventType,
    pointsDelta,
    resultingHomeScore: state.homeScore,
    resultingAwayScore: state.awayScore,
    text,
  };
  state.playByPlay.unshift(event);
  state.possession = defenseSide;
  state.possessionElapsed = 0;
  state.shotClock = 24;
  state.possessionTarget = getPossessionSeconds(state, ctx.tactics || {});
  const diff = state.homeScore - state.awayScore;
  state.momentum = clamp(50 + (diff * 1.25), 0, 100);
  state.status = 'live';
  validateConsistency(state);
  return state;
}

export function advanceSimulationSecond(state, ctx) {
  if (state.isFinal) return state;
  state.status = 'live';
  state.gameClockSeconds = Math.max(0, state.gameClockSeconds - 1);
  state.shotClock = Math.max(0, state.shotClock - 1);
  state.possessionElapsed += 1;
  const shouldResolve = state.possessionElapsed >= state.possessionTarget || state.shotClock <= 0;
  if (shouldResolve) resolvePossession(state, ctx);
  if (state.gameClockSeconds <= 0 && !state.isFinal) transitionQuarter(state);
  validateConsistency(state);
  return state;
}

export function playOnePossession(state, ctx) {
  state.possessionElapsed = state.possessionTarget;
  resolvePossession(state, ctx);
  return state;
}

export function playUntilQuarterEnd(state, ctx, maxSteps = 800) {
  const q = state.quarter;
  let steps = 0;
  while (!state.isFinal && state.quarter === q && steps < maxSteps) {
    advanceSimulationSecond(state, ctx);
    steps += 1;
  }
  return state;
}

export function quickSimToEndLocal(state, ctx, maxSteps = 6000) {
  let steps = 0;
  while (!state.isFinal && steps < maxSteps) {
    advanceSimulationSecond(state, ctx);
    steps += 1;
  }
  return state;
}

export function applyOfficialResultToState(state, details) {
  const home = Number(details?.homeScore || 0);
  const away = Number(details?.awayScore || 0);
  state.homeScore = home;
  state.awayScore = away;
  state.homeStats.pts = home;
  state.awayStats.pts = away;
  state.homeStats.reb = Number(details?.basicStats?.home?.rebounds || state.homeStats.reb || 0);
  state.awayStats.reb = Number(details?.basicStats?.away?.rebounds || state.awayStats.reb || 0);
  state.homeStats.ast = Number(details?.basicStats?.home?.assists || state.homeStats.ast || 0);
  state.awayStats.ast = Number(details?.basicStats?.away?.assists || state.awayStats.ast || 0);
  state.homeStats.tov = Number(details?.basicStats?.home?.turnovers || state.homeStats.tov || 0);
  state.awayStats.tov = Number(details?.basicStats?.away?.turnovers || state.awayStats.tov || 0);
  state.homeStats.threeMade = Number(details?.basicStats?.home?.threePtMade || state.homeStats.threeMade || 0);
  state.homeStats.threeAtt = Number(details?.basicStats?.home?.threePtAtt || state.homeStats.threeAtt || 0);
  state.awayStats.threeMade = Number(details?.basicStats?.away?.threePtMade || state.awayStats.threeMade || 0);
  state.awayStats.threeAtt = Number(details?.basicStats?.away?.threePtAtt || state.awayStats.threeAtt || 0);
  state.homeStats.ftMade = Number(details?.basicStats?.home?.ftMade || state.homeStats.ftMade || 0);
  state.homeStats.ftAtt = Number(details?.basicStats?.home?.ftAtt || state.homeStats.ftAtt || 0);
  state.awayStats.ftMade = Number(details?.basicStats?.away?.ftMade || state.awayStats.ftMade || 0);
  state.awayStats.ftAtt = Number(details?.basicStats?.away?.ftAtt || state.awayStats.ftAtt || 0);
  state.quarterScores.home = [0, 0, 0, home, 0];
  state.quarterScores.away = [0, 0, 0, away, 0];
  state.playByPlay = [
    {
      id: `official-away-${Date.now()}`,
      quarter: 'Q4',
      gameClock: '0:05',
      team: 'away',
      playerId: null,
      playerName: null,
      assistPlayerId: null,
      eventType: 'official_total_sync',
      pointsDelta: away,
      resultingHomeScore: 0,
      resultingAwayScore: away,
      text: `Official sync: ${details?.awayTeam?.shortName || 'AWY'} total ${away}`,
    },
    {
      id: `official-home-${Date.now() + 1}`,
      quarter: 'Q4',
      gameClock: '0:00',
      team: 'home',
      playerId: null,
      playerName: null,
      assistPlayerId: null,
      eventType: 'official_total_sync',
      pointsDelta: home,
      resultingHomeScore: home,
      resultingAwayScore: away,
      text: `Official final: ${details?.awayTeam?.shortName || 'AWY'} ${away} - ${details?.homeTeam?.shortName || 'HME'} ${home}`,
    },
  ];
  state.quarter = 4;
  state.gameClockSeconds = 0;
  state.shotClock = 0;
  state.isFinal = true;
  state.status = 'finished';
  state.momentum = clamp(50 + ((home - away) * 1.25), 0, 100);
  validateConsistency(state);
  return state;
}

export function deriveTopPerformers(state) {
  const home = Object.values(state.homePlayers || {});
  const away = Object.values(state.awayPlayers || {});
  const all = [...home, ...away].sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  return {
    home: home.sort((a, b) => Number(b.points || 0) - Number(a.points || 0))[0] || null,
    away: away.sort((a, b) => Number(b.points || 0) - Number(a.points || 0))[0] || null,
    leader: all[0] || null,
  };
}

export function getConsistencySnapshot(state) {
  const qHome = state.quarterScores.home.reduce((s, x) => s + Number(x || 0), 0);
  const qAway = state.quarterScores.away.reduce((s, x) => s + Number(x || 0), 0);
  const pHome = state.playByPlay.reduce((s, e) => s + (e.team === 'home' ? Number(e.pointsDelta || 0) : 0), 0);
  const pAway = state.playByPlay.reduce((s, e) => s + (e.team === 'away' ? Number(e.pointsDelta || 0) : 0), 0);
  return {
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    qHome,
    qAway,
    pbpHome: pHome,
    pbpAway: pAway,
    issues: validateConsistency({ ...state, debug: false }),
  };
}

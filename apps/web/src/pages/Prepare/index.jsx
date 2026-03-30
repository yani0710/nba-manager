import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { formatFixtureDate, formatFixtureDateTime, getFixtureDateKeyEt, isFixtureCompleted } from '../../domain/fixtures';
import './prepare.css';

function parseGameIdFromHash() {
  const raw = window.location.hash || '';
  const idx = raw.indexOf('?');
  if (idx < 0) return null;
  const qs = new URLSearchParams(raw.slice(idx + 1));
  const value = Number(qs.get('gameId'));
  return Number.isFinite(value) ? value : null;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function seededMetric(seed, min, max) {
  let h = 2166136261;
  const s = String(seed || 'seed');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const ratio = (h >>> 0) / 4294967295;
  return Math.round(min + (max - min) * ratio);
}

function logoPath(team) {
  const short = String(team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
}

function toRecordText(record) {
  if (!record) return 'Record N/A';
  const wins = Number(record.wins);
  const losses = Number(record.losses);
  if (!Number.isFinite(wins) || !Number.isFinite(losses)) return 'Record N/A';
  return `${wins}-${losses}`;
}

function computeTeamRecords(results) {
  const map = new Map();
  for (const game of results || []) {
    if (!isFixtureCompleted(game)) continue;
    const home = String(game.homeTeam?.shortName || '').toUpperCase();
    const away = String(game.awayTeam?.shortName || '').toUpperCase();
    if (!home || !away) continue;
    if (!map.has(home)) map.set(home, { wins: 0, losses: 0 });
    if (!map.has(away)) map.set(away, { wins: 0, losses: 0 });
    const homeScore = Number(game.homeScore ?? 0);
    const awayScore = Number(game.awayScore ?? 0);
    if (homeScore >= awayScore) {
      map.get(home).wins += 1;
      map.get(away).losses += 1;
    } else {
      map.get(away).wins += 1;
      map.get(home).losses += 1;
    }
  }
  return map;
}

function getDaysUntil(gameDate, currentDateKey) {
  if (!gameDate || !currentDateKey) return null;
  const fixtureKey = getFixtureDateKeyEt(gameDate);
  if (!fixtureKey) return null;
  const delta = Math.round((new Date(`${fixtureKey}T00:00:00Z`) - new Date(`${currentDateKey}T00:00:00Z`)) / 86400000);
  return Math.max(0, delta);
}

function getLastMeeting(results, teamA, teamB) {
  const a = String(teamA || '').toUpperCase();
  const b = String(teamB || '').toUpperCase();
  if (!a || !b) return null;

  const filtered = (results || [])
    .filter((g) => {
      const home = String(g.homeTeam?.shortName || '').toUpperCase();
      const away = String(g.awayTeam?.shortName || '').toUpperCase();
      return (home === a && away === b) || (home === b && away === a);
    })
    .sort((x, y) => new Date(y.gameDate) - new Date(x.gameDate));

  if (!filtered.length) return null;
  const game = filtered[0];
  const home = String(game.homeTeam?.shortName || '').toUpperCase();
  const away = String(game.awayTeam?.shortName || '').toUpperCase();
  const homeScore = Number(game.homeScore ?? 0);
  const awayScore = Number(game.awayScore ?? 0);
  const teamAWon = home === a ? homeScore >= awayScore : awayScore >= homeScore;
  const myScore = home === a ? homeScore : awayScore;
  const oppScore = home === a ? awayScore : homeScore;
  return `${teamAWon ? 'W' : 'L'} ${myScore}-${oppScore}`;
}

export function Prepare() {
  const {
    currentSave,
    scheduleGames,
    results,
    squadPlayers,
    playerTrainingPlans,
    fetchSchedule,
    fetchResults,
    fetchSquad,
    fetchPlayerTrainingPlans,
  } = useGameStore();

  const [selectedGameId, setSelectedGameId] = useState(parseGameIdFromHash());

  useEffect(() => {
    fetchSchedule();
    fetchResults();
    fetchSquad();
    fetchPlayerTrainingPlans();
  }, [fetchSchedule, fetchResults, fetchSquad, fetchPlayerTrainingPlans]);

  useEffect(() => {
    const handleHashChange = () => {
      const nextId = parseGameIdFromHash();
      if (Number.isFinite(nextId)) setSelectedGameId(nextId);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const managedTeamShort = String(currentSave?.data?.career?.teamShortName || '').toUpperCase();
  const currentDateKey = currentSave?.data?.currentDate || null;
  const injuries = currentSave?.data?.injuries || [];

  const teamRecords = useMemo(() => computeTeamRecords(results || []), [results]);

  const staleScheduledFixtures = useMemo(() => {
    return (scheduleGames || [])
      .filter((g) => String(g.status || '').toLowerCase() === 'scheduled')
      .filter((g) => {
        const home = String(g.homeTeam?.shortName || '').toUpperCase();
        const away = String(g.awayTeam?.shortName || '').toUpperCase();
        return home === managedTeamShort || away === managedTeamShort;
      })
      .filter((g) => {
        if (!currentDateKey) return false;
        const key = getFixtureDateKeyEt(g.gameDate);
        return Boolean(key) && key < currentDateKey;
      })
      .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
  }, [scheduleGames, managedTeamShort, currentDateKey]);

  const teamFixtures = useMemo(() => {
    return (scheduleGames || [])
      .filter((g) => !isFixtureCompleted(g))
      .filter((g) => {
        const home = String(g.homeTeam?.shortName || '').toUpperCase();
        const away = String(g.awayTeam?.shortName || '').toUpperCase();
        return home === managedTeamShort || away === managedTeamShort;
      })
      .filter((g) => {
        if (!currentDateKey) return true;
        const key = getFixtureDateKeyEt(g.gameDate);
        return Boolean(key) && key >= currentDateKey;
      })
      .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
  }, [scheduleGames, managedTeamShort, currentDateKey]);

  useEffect(() => {
    if (!teamFixtures.length) return;
    const explicitHashId = parseGameIdFromHash();
    if (explicitHashId && teamFixtures.some((g) => Number(g.id) === Number(explicitHashId))) {
      setSelectedGameId(explicitHashId);
      return;
    }
    if (selectedGameId && teamFixtures.some((g) => Number(g.id) === Number(selectedGameId))) return;
    const nextActual = teamFixtures.find((g) => {
      if (!currentDateKey) return true;
      const key = getFixtureDateKeyEt(g.gameDate);
      return key && key >= currentDateKey;
    });
    setSelectedGameId((nextActual || teamFixtures[0]).id);
  }, [teamFixtures, selectedGameId]);

  const selectedGame = teamFixtures.find((g) => Number(g.id) === Number(selectedGameId)) || teamFixtures[0] || null;
  const nextActualGame = teamFixtures.find((g) => {
    if (!currentDateKey) return true;
    const key = getFixtureDateKeyEt(g.gameDate);
    return key && key >= currentDateKey;
  }) || teamFixtures[0] || null;

  const selectedView = useMemo(() => {
    if (!nextActualGame) return null;
    const home = String(nextActualGame.homeTeam?.shortName || '').toUpperCase();
    const isHome = home === managedTeamShort;
    const managed = isHome ? nextActualGame.homeTeam : nextActualGame.awayTeam;
    const opponent = isHome ? nextActualGame.awayTeam : nextActualGame.homeTeam;
    return { isHome, managed, opponent };
  }, [nextActualGame, managedTeamShort]);

  const recentForm = useMemo(() => {
    const out = [];
    const filtered = (results || [])
      .filter((g) => {
        const home = String(g.homeTeam?.shortName || '').toUpperCase();
        const away = String(g.awayTeam?.shortName || '').toUpperCase();
        return home === managedTeamShort || away === managedTeamShort;
      })
      .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));

    for (const g of filtered) {
      if (!isFixtureCompleted(g)) continue;
      const home = String(g.homeTeam?.shortName || '').toUpperCase();
      const homeScore = Number(g.homeScore ?? 0);
      const awayScore = Number(g.awayScore ?? 0);
      const isWin = home === managedTeamShort ? homeScore >= awayScore : awayScore >= homeScore;
      out.push(isWin ? 'W' : 'L');
      if (out.length >= 5) break;
    }
    return out;
  }, [results, managedTeamShort]);

  const avgFatigue = useMemo(() => {
    if (!squadPlayers?.length) return 18;
    const sum = squadPlayers.reduce((acc, p) => acc + Number(p.fatigue ?? 20), 0);
    return sum / squadPlayers.length;
  }, [squadPlayers]);

  const fitness = Math.round(clamp(100 - avgFatigue, 45, 98));
  const morale = Math.round(clamp(62 + (recentForm.filter((x) => x === 'W').length * 6) - (injuries.length * 3), 35, 96));

  const rotation = currentSave?.data?.rotation || {};
  const tactics = currentSave?.data?.tactics || {};
  const weekPlan = currentSave?.data?.training?.weekPlan || {};
  const jsonPlayerPlans = currentSave?.data?.training?.playerPlans || {};

  const hasStarters = ['PG', 'SG', 'SF', 'PF', 'C'].every((slot) => Number.isFinite(Number(rotation?.[slot])));
  const hasTacticsInstructions = Boolean(tactics?.instructions && Object.keys(tactics.instructions).length > 0);
  const hasGamePlan = Boolean(tactics?.offenseStyle || tactics?.defenseMode || tactics?.pace || tactics?.offensePreset || tactics?.defensePreset);

  const teamWeekDays = Object.keys(weekPlan);
  const hasFullWeekSchedule = teamWeekDays.length >= 7;
  const focusSet = new Set(teamWeekDays.map((day) => String(weekPlan?.[day]?.focus || '').toLowerCase()).filter(Boolean));
  const hasFocusVariety = focusSet.size >= 3;
  const intensityValues = teamWeekDays.map((day) => Number(weekPlan?.[day]?.intensityPercent)).filter(Number.isFinite);
  const hasIntensityConfigured = intensityValues.length >= 5;

  const dbPlansCount = (playerTrainingPlans || []).length;
  const jsonPlansCount = Object.keys(jsonPlayerPlans || {}).length;
  const plansCount = Math.max(dbPlansCount, jsonPlansCount);
  const hasProgramsAssigned = plansCount > 0;
  const hasCourtTimePlan = hasStarters;
  const plansWithDayPlan = (playerTrainingPlans || []).filter((p) => p?.dayPlan && Object.keys(p.dayPlan).length >= 5).length;
  const jsonPlansWithDayPlan = Object.values(jsonPlayerPlans || {}).filter((p) => p?.dayPlan && Object.keys(p.dayPlan).length >= 5).length;
  const hasProgressReview = Math.max(plansWithDayPlan, jsonPlansWithDayPlan) > 0;

  const completionPercent = (count) => (count >= 3 ? 100 : count === 2 ? 82 : count === 1 ? 58 : 32);

  const tacticsDone = [hasStarters, hasTacticsInstructions, hasGamePlan];
  const teamTrainingDone = [hasFullWeekSchedule, hasFocusVariety, hasIntensityConfigured];
  const playerTrainingDone = [hasProgramsAssigned, hasCourtTimePlan, hasProgressReview];

  const tacticsCompletion = completionPercent(tacticsDone.filter(Boolean).length);
  const teamTrainingCompletion = completionPercent(teamTrainingDone.filter(Boolean).length);
  const playerTrainingCompletion = completionPercent(playerTrainingDone.filter(Boolean).length);

  const completedTaskCards = [
    tacticsDone.every(Boolean),
    teamTrainingDone.every(Boolean),
    playerTrainingDone.every(Boolean),
  ].filter(Boolean).length;
  const readiness = Math.round(clamp((tacticsCompletion * 0.4) + (teamTrainingCompletion * 0.34) + (playerTrainingCompletion * 0.26), 25, 99));

  const selectedDays = nextActualGame ? getDaysUntil(nextActualGame.gameDate, currentDateKey) : null;
  const selectedLastMeeting = nextActualGame && selectedView
    ? getLastMeeting(results, managedTeamShort, selectedView.opponent?.shortName)
    : null;

  const opponentOffRating = seededMetric(`${selectedView?.opponent?.shortName}-off`, 106, 121);
  const opponentDefRating = seededMetric(`${selectedView?.opponent?.shortName}-def`, 103, 118);

  const recentWins = recentForm.filter((x) => x === 'W').length;
  const recentWinRate = recentForm.length ? Math.round((recentWins / recentForm.length) * 100) : 0;
  const avgPoints = seededMetric(`${managedTeamShort}-avg-pts`, 106, 120) + (recentWins >= 3 ? 2 : 0);

  const goto = (page) => {
    window.location.hash = page;
  };

  return (
    <div className="prep-page">
      <section className="prep-hero">
        <div>
          <h1>MATCH PREPARATION HUB</h1>
          <p>Prepare tactics, training, and team readiness for upcoming matches</p>
        </div>
        <div className="prep-readiness-chip">
          <span>TEAM READINESS</span>
          <strong>{readiness}%</strong>
        </div>
      </section>

      <section className="prep-progress-wrap">
        <div className="prep-progress-top">
          <span>Overall Match Preparation</span>
          <strong>{readiness}%</strong>
        </div>
        <div className="prep-progress-track"><i style={{ width: `${readiness}%` }} /></div>
        <p className="prep-progress-note">Additional preparation recommended</p>
        {staleScheduledFixtures.length > 0 ? (
          <p className="prep-progress-note prep-progress-note-info">
            {staleScheduledFixtures.length} overdue fixture{staleScheduledFixtures.length === 1 ? '' : 's'} treated as postponed (hidden from upcoming/next-match view).
          </p>
        ) : null}
      </section>

      <section className="prep-grid-main">
        <article className="prep-panel prep-fixtures-panel">
          <header>
            <h3>UPCOMING FIXTURES</h3>
            <span>Next {Math.min(6, teamFixtures.length)} matches</span>
          </header>

          <div className="prep-fixtures-list">
            {teamFixtures.slice(0, 6).map((fixture, idx) => {
              const home = String(fixture.homeTeam?.shortName || '').toUpperCase();
              const isHome = home === managedTeamShort;
              const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
              const isSelected = Number(fixture.id) === Number(selectedGameId);
              const days = getDaysUntil(fixture.gameDate, currentDateKey);
              const importance = idx < 2 ? 'HIGH' : idx < 5 ? 'MEDIUM' : 'LOW';
              const lastMeeting = getLastMeeting(results, managedTeamShort, opponent?.shortName);
              const timeLabel = formatFixtureDateTime(fixture.gameDate).split(', ')[1] || '';

              return (
                <button key={fixture.id} type="button" className={`prep-fixture-row ${isSelected ? 'is-active' : ''}`} onClick={() => setSelectedGameId(fixture.id)}>
                  {idx === 0 ? <span className="prep-next-pill">NEXT MATCH</span> : null}
                  <div className="prep-fixture-left">
                    <div className="prep-team-pill">{opponent?.shortName || 'NBA'}</div>
                    <div className="prep-fixture-info">
                      <h4>{opponent?.name || opponent?.shortName}</h4>
                      <p>
                        <span className={`prep-importance ${importance.toLowerCase()}`}>{importance}</span>
                        <span>{isHome ? 'Home' : 'Away'}</span>
                        <span>Last: {lastMeeting || 'N/A'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="prep-fixture-right">
                    <strong>{timeLabel}</strong>
                    <small>{fixture.awayTeam?.shortName} @ {fixture.homeTeam?.shortName} | {formatFixtureDate(fixture.gameDate)}</small>
                    <b>{Number.isFinite(days) ? `${days} days` : '-'}</b>
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <aside className="prep-right-stack">
          <article className="prep-panel prep-next-preview">
            <header><h3>NEXT MATCH PREVIEW</h3></header>
            {nextActualGame && selectedView ? (
              <>
                <div className="prep-preview-matchup">
                  <div className="prep-preview-team">
                    <div className="prep-preview-logo"><img src={logoPath(selectedView.managed)} alt={selectedView.managed?.shortName} /></div>
                    <strong>{selectedView.managed?.name || selectedView.managed?.shortName}</strong>
                    <span>{toRecordText(teamRecords.get(String(selectedView.managed?.shortName || '').toUpperCase()))} ({selectedView.isHome ? 'Home' : 'Away'})</span>
                  </div>
                  <div className="prep-preview-vs">VS</div>
                  <div className="prep-preview-team">
                    <div className="prep-preview-logo"><img src={logoPath(selectedView.opponent)} alt={selectedView.opponent?.shortName} /></div>
                    <strong>{selectedView.opponent?.name || selectedView.opponent?.shortName}</strong>
                    <span>{toRecordText(teamRecords.get(String(selectedView.opponent?.shortName || '').toUpperCase()))} ({selectedView.isHome ? 'Away' : 'Home'})</span>
                  </div>
                </div>

                <div className="prep-preview-stats">
                  <p><span>Match Importance</span><b className="high">HIGH</b></p>
                  <p><span>Days Until Match</span><b>{Number.isFinite(selectedDays) ? selectedDays : '-'}</b></p>
                  <p><span>Last Meeting</span><b className="good">{selectedLastMeeting || 'N/A'}</b></p>
                </div>

                <button type="button" className="prep-main-action" onClick={() => goto('tactics')}>Start Match Preparation</button>
              </>
            ) : <p className="prep-empty">No upcoming fixture found.</p>}
          </article>

          <article className="prep-panel prep-team-status">
            <header><h3>TEAM STATUS</h3></header>
            <p><span>Squad Fitness</span><b className="good">{fitness}%</b></p>
            <p><span>Team Morale</span><b className="good">{morale >= 75 ? 'Excellent' : morale >= 60 ? 'Good' : 'Mixed'}</b></p>
            <p><span>Formation</span><b>{hasStarters ? 'Set' : 'Pending'}</b></p>
            <p><span>Injuries</span><b className="warn">{injuries.length} Players</b></p>
          </article>
        </aside>
      </section>

      <section className="prep-section-head">
        <h2>Preparation Tasks</h2>
        <span>{completedTaskCards} / 3 Completed</span>
      </section>

      <section className="prep-task-grid">
        <article className="prep-task-card is-tactics">
          <div className="prep-task-top"><h4>Tactics</h4><b>{tacticsCompletion}%</b></div>
          <p>Set formation &amp; game plan</p>
          <div className="prep-task-progress"><i style={{ width: `${tacticsCompletion}%` }} /></div>
          <ul>
            <li className={hasStarters ? 'ok' : ''}>Formation Set</li>
            <li className={hasTacticsInstructions ? 'ok' : ''}>Player Roles</li>
            <li className={hasGamePlan ? 'ok' : ''}>Game Plan</li>
          </ul>
          <div className="prep-task-foot"><span>From saved tactics/rotation data</span><b>{tacticsDone.filter(Boolean).length}/3 tasks</b></div>
          <button type="button" onClick={() => goto('tactics')}>Configure Tactics</button>
        </article>

        <article className="prep-task-card is-team">
          <div className="prep-task-top"><h4>Team Training</h4><b>{teamTrainingCompletion}%</b></div>
          <p>Schedule team sessions</p>
          <div className="prep-task-progress"><i style={{ width: `${teamTrainingCompletion}%` }} /></div>
          <ul>
            <li className={hasFullWeekSchedule ? 'ok' : ''}>Schedule Set</li>
            <li className={hasFocusVariety ? 'ok' : ''}>Focus Areas</li>
            <li className={hasIntensityConfigured ? 'ok' : ''}>Intensity Level</li>
          </ul>
          <div className="prep-task-foot"><span>{teamWeekDays.length} planned days this week</span><b>{teamTrainingDone.filter(Boolean).length}/3 tasks</b></div>
          <button type="button" onClick={() => goto('training/team')}>Configure Team Training</button>
        </article>

        <article className="prep-task-card is-player">
          <div className="prep-task-top"><h4>Player Training</h4><b>{playerTrainingCompletion}%</b></div>
          <p>Individual development plans</p>
          <div className="prep-task-progress"><i style={{ width: `${playerTrainingCompletion}%` }} /></div>
          <ul>
            <li className={hasProgramsAssigned ? 'ok' : ''}>Programs Assigned</li>
            <li className={hasCourtTimePlan ? 'ok' : ''}>Court Time</li>
            <li className={hasProgressReview ? 'ok' : ''}>Progress Review</li>
          </ul>
          <div className="prep-task-foot"><span>{plansCount} player plans saved</span><b>{playerTrainingDone.filter(Boolean).length}/3 tasks</b></div>
          <button type="button" onClick={() => goto('training/players')}>Configure Player Training</button>
        </article>
      </section>

      <section className="prep-bottom-grid">
        <article className="prep-panel prep-analysis">
          <header><h3>Opponent Analysis</h3><span>Study strengths &amp; weaknesses</span></header>
          <div className="prep-analysis-list">
            <p><span>Offensive Rating</span><b>{opponentOffRating.toFixed(1)} PPG</b></p>
            <p><span>Defensive Rating</span><b>{opponentDefRating.toFixed(1)} PPG</b></p>
            <p><span>Key Players</span><b>{selectedView?.opponent?.name ? selectedView.opponent.name.split(' ').slice(-1)[0] : 'Top Unit'} Core</b></p>
          </div>
          <button type="button" className="prep-sub-action" onClick={() => goto('match-center')}>View Full Scout Report</button>
        </article>

        <article className="prep-panel prep-recent-form">
          <header><h3>Recent Form</h3><span>Last 5 matches performance</span></header>
          <div className="prep-form-row">
            {(recentForm.length ? recentForm : ['W', 'W', 'L', 'W', 'W']).map((item, idx) => (
              <span key={`${item}-${idx}`} className={item === 'W' ? 'is-win' : 'is-loss'}>{item}</span>
            ))}
          </div>
          <div className="prep-form-stats">
            <p><span>Win Rate</span><b className="good">{recentWinRate || 0}%</b></p>
            <p><span>Avg Points</span><b>{avgPoints.toFixed(1)}</b></p>
          </div>
        </article>
      </section>
    </div>
  );
}

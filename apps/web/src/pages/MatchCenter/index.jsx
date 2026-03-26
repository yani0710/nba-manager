import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { api } from '../../api/client';
import { getFixtureDateKeyEt, isFixtureCompleted, isFixtureSimulatable } from '../../domain/fixtures';
import { buildAdvice, formatClock, getLineupByPosition, quarterLabel } from './matchSimUtils';
import {
  advanceSimulationSecond,
  applyOfficialResultToState,
  createMatchState,
  deriveTopPerformers,
  getConsistencySnapshot,
  playOnePossession,
  playUntilQuarterEnd,
  quickSimToEndLocal,
} from './matchSimulationEngine';
import './match-center.css';

function logoFor(team) {
  const short = (team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
}

function pct(made, att) {
  if (!att) return 0;
  return Number(((Number(made || 0) / Number(att || 1)) * 100).toFixed(1));
}

function scoreBarValue(left, right) {
  const total = Number(left || 0) + Number(right || 0);
  if (!total) return 50;
  return Math.max(5, Math.min(95, (Number(left || 0) / total) * 100));
}

function cloneState(state) {
  const { rng, ...serializable } = state || {};
  const out = structuredClone(serializable);
  out.rng = rng;
  return out;
}

export function MatchCenter() {
  const {
    currentSave,
    teams,
    players,
    scheduleGames,
    fetchTeams,
    fetchPlayers,
    fetchSchedule,
    fetchResults,
    fetchStandings,
    fetchDashboard,
    fetchResultDetails,
  } = useGameStore();

  const [selectedGameId, setSelectedGameId] = useState(null);
  const [simMode, setSimMode] = useState('watch');
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [officialResultLocked, setOfficialResultLocked] = useState(false);
  const [persistingResult, setPersistingResult] = useState(false);
  const [simError, setSimError] = useState('');
  const [simState, setSimState] = useState(null);
  const tickerRef = useRef(null);
  const autoPersistRef = useRef(false);

  const managedCode = currentSave?.data?.career?.teamShortName;
  const currentDate = String(currentSave?.data?.currentDate || '').slice(0, 10);

  useEffect(() => {
    if (!currentSave?.id) return;
    fetchSchedule();
    if (!teams?.length) fetchTeams();
    if (!players?.length) fetchPlayers();
  }, [currentSave?.id, fetchSchedule, fetchTeams, fetchPlayers, teams?.length, players?.length]);

  const upcomingGames = useMemo(
    () => (scheduleGames || [])
      .filter((g) => !isFixtureCompleted(g))
      .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate)),
    [scheduleGames],
  );

  useEffect(() => {
    if (!upcomingGames.length) {
      setSelectedGameId(null);
      return;
    }
    if (selectedGameId && upcomingGames.some((g) => g.id === selectedGameId)) return;
    const preferred = upcomingGames.find((g) => g.homeTeam?.shortName === managedCode || g.awayTeam?.shortName === managedCode);
    setSelectedGameId((preferred || upcomingGames[0]).id);
  }, [upcomingGames, selectedGameId, managedCode]);

  const selectedGame = useMemo(
    () => upcomingGames.find((g) => g.id === selectedGameId) || null,
    [upcomingGames, selectedGameId],
  );

  const gameDay = selectedGame?.gameDate ? getFixtureDateKeyEt(selectedGame.gameDate) : null;
  const canLiveSim = Boolean(selectedGame && isFixtureSimulatable(selectedGame, currentDate));
  const canOfficialSim = Boolean(selectedGame && isFixtureSimulatable(selectedGame, currentDate) && gameDay === currentDate);

  const homeTeamObj = useMemo(
    () => teams.find((t) => t.id === selectedGame?.homeTeamId) || selectedGame?.homeTeam || null,
    [teams, selectedGame],
  );
  const awayTeamObj = useMemo(
    () => teams.find((t) => t.id === selectedGame?.awayTeamId) || selectedGame?.awayTeam || null,
    [teams, selectedGame],
  );

  const rosters = useMemo(() => {
    if (!selectedGame) return { home: [], away: [] };
    return {
      home: players.filter((p) => Number(p.teamId) === Number(selectedGame.homeTeamId)),
      away: players.filter((p) => Number(p.teamId) === Number(selectedGame.awayTeamId)),
    };
  }, [players, selectedGame]);

  const lineups = useMemo(() => {
    if (!selectedGame) return { home: {}, away: {} };
    return {
      home: getLineupByPosition(rosters.home, selectedGame.homeTeam?.shortName || 'HOME'),
      away: getLineupByPosition(rosters.away, selectedGame.awayTeam?.shortName || 'AWAY'),
    };
  }, [selectedGame?.id, rosters.home, rosters.away]);

  const ctx = useMemo(() => ({
    homeTeam: homeTeamObj || {},
    awayTeam: awayTeamObj || {},
    homeLineup: lineups.home,
    awayLineup: lineups.away,
    tactics: { slowPace: false, transitionPush: true, fullCourtPress: false, isoPlays: false, feedPost: false },
  }), [homeTeamObj, awayTeamObj, lineups.home, lineups.away]);

  useEffect(() => {
    if (!selectedGame) return;
    const seed = `${currentSave?.id || 0}-${selectedGame.id}-${selectedGame.gameDate || ''}`;
    const st = createMatchState({
      seed,
      homeLineup: lineups.home,
      awayLineup: lineups.away,
      debug: true,
    });
    setSimState(st);
    setRunning(false);
    setOfficialResultLocked(false);
    setPersistingResult(false);
    autoPersistRef.current = false;
  }, [selectedGame?.id]);

  const pushMatchdayWarning = () => {
    setSimState((prev) => {
      if (!prev) return prev;
      const next = cloneState(prev);
      next.playByPlay.unshift({
        id: `warning-${Date.now()}`,
        quarter: quarterLabel(next.quarter),
        gameClock: formatClock(next.gameClockSeconds),
        team: 'neutral',
        playerId: null,
        playerName: null,
        assistPlayerId: null,
        eventType: 'warning',
        pointsDelta: 0,
        resultingHomeScore: next.homeScore,
        resultingAwayScore: next.awayScore,
        text: 'Simulation actions are allowed only on the current match day.',
      });
      return next;
    });
  };

  const safeSetSim = (updater) => {
    setSimState((prev) => {
      try {
        return updater(prev);
      } catch (error) {
        setRunning(false);
        setSimError(error?.message || 'Simulation error');
        return prev;
      }
    });
  };

  useEffect(() => {
    if (!running || !simState) return undefined;
    // Tune pacing for smoother but noticeably faster simulation.
    const ms = Math.max(24, Math.round(1000 / (speed * 12)));
    tickerRef.current = window.setInterval(() => {
      safeSetSim((prev) => {
        if (!prev || prev.isFinal || officialResultLocked || !canLiveSim) return prev;
        const next = cloneState(prev);
        advanceSimulationSecond(next, ctx);
        return next;
      });
    }, ms);
    return () => {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
    };
  }, [running, speed, simState, officialResultLocked, canLiveSim, ctx]);

  const onPlayPossession = () => {
    if (!canLiveSim) return pushMatchdayWarning();
    if (!simState || simState.isFinal || officialResultLocked) return;
    safeSetSim((prev) => {
      const next = cloneState(prev);
      playOnePossession(next, ctx);
      return next;
    });
  };

  const onPlayQuarter = () => {
    if (!canLiveSim) return pushMatchdayWarning();
    if (!simState || simState.isFinal || officialResultLocked) return;
    safeSetSim((prev) => {
      const next = cloneState(prev);
      playUntilQuarterEnd(next, ctx);
      return next;
    });
  };

  const runOfficialSimToEnd = async () => {
    if (!currentSave?.id || !selectedGame || officialResultLocked) return;
    if (!canOfficialSim) return pushMatchdayWarning();
    setRunning(false);
    setPersistingResult(true);
    try {
      let finalState = simState;
      if (finalState && !finalState.isFinal) {
        finalState = cloneState(finalState);
        quickSimToEndLocal(finalState, ctx);
        setSimState(finalState);
      }
      if (!finalState?.isFinal) return;

      await api.saves.finalizeMatchSimulation(currentSave.id, selectedGame.id, {
        homeScore: finalState.homeScore,
        awayScore: finalState.awayScore,
        homePlayers: Object.values(finalState.homePlayers || {}),
        awayPlayers: Object.values(finalState.awayPlayers || {}),
      });

      await Promise.all([
        fetchSchedule(),
        fetchResults(),
        fetchStandings(),
        fetchDashboard(),
      ]);

      const details = await fetchResultDetails(selectedGame.id);
      if (details) {
        safeSetSim((prev) => {
          if (!prev) return prev;
          const next = cloneState(prev);
          applyOfficialResultToState(next, details);
          return next;
        });
      }
      setOfficialResultLocked(true);
    } finally {
      setPersistingResult(false);
    }
  };

  useEffect(() => {
    if (!simState?.isFinal) return;
    if (officialResultLocked || persistingResult) return;
    if (!canOfficialSim) return;
    if (autoPersistRef.current) return;
    autoPersistRef.current = true;
    void runOfficialSimToEnd();
  }, [simState?.isFinal, officialResultLocked, persistingResult, canOfficialSim]);

  const state = simState;
  const performers = useMemo(() => (state ? deriveTopPerformers(state) : { home: null, away: null, leader: null }), [state]);
  const advice = useMemo(
    () => (state ? buildAdvice({
      homeTactics: { fullCourtPress: false, slowPace: false, isoPlays: false },
      awayTactics: { feedPost: false },
      homeStats: state.homeStats || {},
      awayStats: state.awayStats || {},
      possessionSide: state.possession === 'home' ? 'home' : 'away',
      homeTeam: selectedGame?.homeTeam,
      awayTeam: selectedGame?.awayTeam,
    }) : []),
    [state, selectedGame],
  );

  if (!selectedGame || !state) {
    return (
      <div className="matchday-premium">
        <div className="mc-broadcast">
          <h1>Match Center</h1>
          <span className="mc-live">LIVE</span>
          <span className="mc-conf">Western Conference</span>
        </div>
        <div className="mc-empty">No upcoming games available.</div>
      </div>
    );
  }

  const consistency = getConsistencySnapshot({ ...state, debug: false });
  const momentum = Number(state.momentum || 50);
  const matchState = state.status || (state.isFinal ? 'finished' : 'live');
  const attackingLabel = state.possession === 'home' ? selectedGame.homeTeam?.shortName : selectedGame.awayTeam?.shortName;
  const qAway = state.quarterScores?.away || [0, 0, 0, 0, 0];
  const qHome = state.quarterScores?.home || [0, 0, 0, 0, 0];

  return (
    <div className="matchday-premium">
      <div className="mc-broadcast">
        <h1>Match Center</h1>
        <span className="mc-live">LIVE</span>
        <span className="mc-conf">Western Conference</span>
      </div>

      <div className="mc-game-select">
        <select className="ui-select" value={selectedGameId || ''} onChange={(e) => setSelectedGameId(Number(e.target.value) || null)}>
          {upcomingGames.map((game) => (
            <option key={game.id} value={game.id}>{game.awayTeam?.shortName} @ {game.homeTeam?.shortName} ({getFixtureDateKeyEt(game.gameDate)})</option>
          ))}
        </select>
        <div className="mc-mode">
          <button type="button" className={`ui-btn ${simMode === 'watch' ? 'active' : ''}`} onClick={() => setSimMode('watch')}>Watch</button>
          <button type="button" className={`ui-btn ${simMode === 'simulate' ? 'active' : ''}`} onClick={() => setSimMode('simulate')}>Simulate</button>
        </div>
      </div>
      {simError ? <div className="transfer-toast">Simulation error: {simError}</div> : null}

      <section className="mc-hero">
        <div className="mc-score-row">
          <article className="mc-team-side">
            <img src={logoFor(selectedGame.awayTeam)} alt={selectedGame.awayTeam?.shortName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div>
              <small>{selectedGame.awayTeam?.city || selectedGame.awayTeam?.name}</small>
              <h3>{selectedGame.awayTeam?.name || selectedGame.awayTeam?.shortName}</h3>
            </div>
            <strong>{state.awayScore}</strong>
          </article>
          <div className="mc-clock-tile">
            <strong>{state.isFinal ? '0:00' : formatClock(state.gameClockSeconds)}</strong>
            <span>{state.isFinal ? 'FINAL' : quarterLabel(state.quarter)}</span>
          </div>
          <article className="mc-team-side right">
            <strong>{state.homeScore}</strong>
            <div>
              <small>{selectedGame.homeTeam?.city || selectedGame.homeTeam?.name}</small>
              <h3>{selectedGame.homeTeam?.name || selectedGame.homeTeam?.shortName}</h3>
            </div>
            <img src={logoFor(selectedGame.homeTeam)} alt={selectedGame.homeTeam?.shortName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </article>
        </div>
        <div className="mc-venue">Crypto.com Arena</div>
        <div className="mc-court-wire">
          <div className="mc-wire-left-circle" />
          <div className="mc-wire-mid-circle" />
          <div className="mc-wire-right-circle" />
          <div className="mc-wire-mid-line" />
        </div>
        <div className="mc-momentum-wrap">
          <span>{selectedGame.awayTeam?.shortName} Momentum</span>
          <div className="mc-momentum">
            <div className="mc-momentum-fill" style={{ width: `${momentum}%` }} />
            <div className="mc-momentum-marker" style={{ left: `${momentum}%` }} />
            <div className={`mc-attack-marker ${state.possession || 'home'}`} />
          </div>
          <span>{selectedGame.homeTeam?.shortName} Momentum</span>
        </div>
        <div className="mc-possession-row">
          <span className={`mc-possession-pill ${state.possession || 'home'}`}>Attacking: {attackingLabel}</span>
        </div>
      </section>

      <section className="mc-grid">
        <article className="mc-card mc-controls">
          <h3>Simulation Controls</h3>
          <div className="mc-controls-row">
            <button
              className="ui-btn"
              type="button"
              disabled={!canLiveSim || officialResultLocked || persistingResult}
              onClick={() => {
                if (!canLiveSim) return pushMatchdayWarning();
                setRunning((prev) => !prev);
              }}
            >
              {running ? 'Pause' : 'Start'}
            </button>
            <button className="ui-btn" type="button" onClick={() => setSpeed((prev) => (prev === 1 ? 2 : (prev === 2 ? 4 : (prev === 4 ? 8 : 1))))}>{speed}x</button>
          </div>
          <button className="ui-btn ui-btn-primary mc-full" type="button" onClick={() => { setSimMode('watch'); setRunning(false); }}>Play Game - Jump In</button>
          <button className="ui-btn mc-full" type="button" disabled={!canOfficialSim || officialResultLocked || persistingResult} onClick={runOfficialSimToEnd}>{persistingResult ? 'Saving result...' : 'Quick Sim to End'}</button>
          <div className="mc-controls-row">
            <button className="ui-btn" type="button" disabled={!canLiveSim || officialResultLocked || persistingResult} onClick={onPlayPossession}>Play Possession</button>
            <button className="ui-btn" type="button" disabled={!canLiveSim || officialResultLocked || persistingResult} onClick={onPlayQuarter}>Play Quarter</button>
          </div>
          <div className="mc-status-row">
            <span className="mc-tag">{matchState}</span>
            {!canLiveSim ? <span className="mc-tag warn">Live sim unavailable for this date</span> : null}
            {!canOfficialSim ? <span className="mc-tag warn">Quick Sim locked to matchday</span> : null}
            {officialResultLocked ? <span className="mc-tag">Official Result Saved</span> : null}
            {consistency.issues.length ? <span className="mc-tag warn">Consistency warning</span> : null}
          </div>
        </article>

        <article className="mc-card mc-quarter">
          <h3>Quarter Breakdown</h3>
          <table>
            <thead><tr><th>Team</th><th>1st</th><th>2nd</th><th>3rd</th><th>4th</th><th>Total</th></tr></thead>
            <tbody>
              <tr><td>{selectedGame.awayTeam?.shortName}</td><td>{qAway[0] || 0}</td><td>{qAway[1] || '-'}</td><td>{qAway[2] || '-'}</td><td>{qAway[3] || '-'}</td><td>{state.awayScore}</td></tr>
              <tr><td>{selectedGame.homeTeam?.shortName}</td><td>{qHome[0] || 0}</td><td>{qHome[1] || '-'}</td><td>{qHome[2] || '-'}</td><td>{qHome[3] || '-'}</td><td>{state.homeScore}</td></tr>
            </tbody>
          </table>
        </article>

        <article className="mc-card mc-performers">
          <h3>Top Performers</h3>
          {[performers.away, performers.home].filter(Boolean).map((row) => (
            <div key={row.playerId} className="mc-performer-row">
              <strong>{row.name}</strong>
              <div><span>PTS {row.points || 0}</span><span>REB {row.rebounds || 0}</span><span>AST {row.assists || 0}</span></div>
            </div>
          ))}
          {performers.leader ? <p className="mc-overall-top">Game Leader: {performers.leader.name} ({performers.leader.points || 0} pts)</p> : null}
        </article>

        <article className="mc-card mc-advice">
          <h3>Scout Advice</h3>
          {advice.map((msg) => <p key={msg}>{msg}</p>)}
        </article>

        <article className="mc-card mc-play">
          <h3>Play-by-Play</h3>
          <div className="mc-play-list">
            {state.playByPlay.map((event) => (
              <div key={event.id} className={`mc-play-item ${event.team || 'neutral'}`}>
                <div>
                  <strong>{event.text}</strong>
                  <small>{event.quarter} - {event.gameClock} • {event.resultingAwayScore}-{event.resultingHomeScore}</small>
                </div>
                <span>{event.pointsDelta > 0 ? `+${event.pointsDelta}` : '0'}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="mc-right-stack">
          <article className="mc-card mc-team-stats">
            <h3>Team Stats</h3>
            {[
              ['Field Goal %', pct(state.awayStats.fgMade, state.awayStats.fgAtt), pct(state.homeStats.fgMade, state.homeStats.fgAtt)],
              ['3-Point %', pct(state.awayStats.threeMade, state.awayStats.threeAtt), pct(state.homeStats.threeMade, state.homeStats.threeAtt)],
              ['Free Throw %', pct(state.awayStats.ftMade, state.awayStats.ftAtt), pct(state.homeStats.ftMade, state.homeStats.ftAtt)],
              ['Rebounds', Number(state.awayStats.reb || 0), Number(state.homeStats.reb || 0)],
              ['Assists', Number(state.awayStats.ast || 0), Number(state.homeStats.ast || 0)],
              ['Turnovers', Number(state.awayStats.tov || 0), Number(state.homeStats.tov || 0)],
            ].map(([label, leftVal, rightVal]) => (
              <div key={label} className="mc-stat-row">
                <div className="mc-stat-head">
                  <strong>{leftVal}</strong>
                  <span>{label}</span>
                  <strong>{rightVal}</strong>
                </div>
                <div className="mc-stat-bars">
                  <span className="left" style={{ width: `${scoreBarValue(leftVal, rightVal)}%` }} />
                  <span className="right" style={{ width: `${scoreBarValue(rightVal, leftVal)}%` }} />
                </div>
              </div>
            ))}
          </article>

          <article className="mc-card mc-match-info">
            <h3>Match Info</h3>
            <p><span>Venue:</span><strong>Crypto.com Arena</strong></p>
            <p><span>Attendance:</span><strong>18,997</strong></p>
            <p><span>Referees:</span><strong>3 Officials</strong></p>
            <p><span>Temperature:</span><strong>72°F</strong></p>
          </article>
        </aside>
      </section>
    </div>
  );
}

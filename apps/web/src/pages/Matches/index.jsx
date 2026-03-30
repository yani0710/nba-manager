import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, SkeletonCard } from '../../components/ui';
import { formatFixtureDate, formatFixtureDateTime, getFixtureDateKeyEt, isFixtureCompleted } from '../../domain/fixtures';
import '../Matches.css';

const TAB_UPCOMING = 'upcoming';
const TAB_RESULTS = 'results';

const initials = (team) => String(team?.shortName || 'NBA').slice(0, 3).toUpperCase();

const logoPath = (team) => {
  const short = (team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
};

function hashMetric(seed, min, max) {
  let h = 2166136261;
  const text = String(seed || 'seed');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const ratio = (h >>> 0) / 4294967295;
  return Math.round(min + (max - min) * ratio);
}

function safeRecord(team) {
  const wins = team?.wins;
  const losses = team?.losses;
  if (Number.isFinite(Number(wins)) && Number.isFinite(Number(losses))) {
    return `${wins}-${losses}`;
  }
  return 'Record N/A';
}

function normalizeRecord(record) {
  if (!record) return null;
  const wins = Number(record.wins);
  const losses = Number(record.losses);
  if (Number.isFinite(wins) && Number.isFinite(losses)) {
    return { wins, losses };
  }
  return null;
}

function buildForm(games, teamShort, limit = 5) {
  if (!teamShort) return [];
  const list = [];
  for (const game of games) {
    if (!isFixtureCompleted(game)) continue;
    const homeShort = String(game.homeTeam?.shortName || '').toUpperCase();
    const awayShort = String(game.awayTeam?.shortName || '').toUpperCase();
    const isHome = homeShort === teamShort;
    const isAway = awayShort === teamShort;
    if (!isHome && !isAway) continue;
    const myScore = isHome ? Number(game.homeScore ?? 0) : Number(game.awayScore ?? 0);
    const oppScore = isHome ? Number(game.awayScore ?? 0) : Number(game.homeScore ?? 0);
    list.push(myScore >= oppScore ? 'W' : 'L');
    if (list.length >= limit) break;
  }
  return list;
}

function toMatchView(game, teamShort) {
  const homeShort = String(game.homeTeam?.shortName || '').toUpperCase();
  const awayShort = String(game.awayTeam?.shortName || '').toUpperCase();
  const isHome = homeShort === teamShort;
  const isAway = awayShort === teamShort;

  if (!isHome && !isAway) return null;

  const managedTeam = isHome ? game.homeTeam : game.awayTeam;
  const opponentTeam = isHome ? game.awayTeam : game.homeTeam;

  return {
    game,
    isHome,
    managedTeam,
    opponentTeam,
  };
}

function daysUntilGame(gameDate, currentDateKey) {
  if (!gameDate || !currentDateKey) return null;
  const target = getFixtureDateKeyEt(gameDate);
  if (!target) return null;
  const delta = Math.round((new Date(`${target}T00:00:00Z`) - new Date(`${currentDateKey}T00:00:00Z`)) / 86400000);
  return Math.max(0, delta);
}

function buildImportanceTone(index) {
  if (index === 0) return { label: 'HIGH', tone: 'danger' };
  if (index === 1) return { label: 'HIGH', tone: 'danger' };
  if (index <= 3) return { label: 'MEDIUM', tone: 'warning' };
  return { label: 'LOW', tone: 'cool' };
}

function didTeamWin(game, teamShort) {
  const homeShort = String(game.homeTeam?.shortName || '').toUpperCase();
  const awayShort = String(game.awayTeam?.shortName || '').toUpperCase();
  const homeScore = Number(game.homeScore ?? 0);
  const awayScore = Number(game.awayScore ?? 0);
  if (homeShort === teamShort) return homeScore >= awayScore;
  if (awayShort === teamShort) return awayScore >= homeScore;
  return null;
}

function computePrediction({
  managedShort,
  opponentShort,
  isHome,
  rankingByShort,
  recordByShort,
  lastResultByShort,
}) {
  let score = 50;

  const managedRank = rankingByShort.get(managedShort);
  const opponentRank = rankingByShort.get(opponentShort);
  if (Number.isFinite(managedRank) && Number.isFinite(opponentRank)) {
    score += (opponentRank - managedRank) * 2.5;
  }

  const managedRecord = recordByShort.get(managedShort);
  const opponentRecord = recordByShort.get(opponentShort);
  if (managedRecord && opponentRecord) {
    const managedGames = Math.max(1, managedRecord.wins + managedRecord.losses);
    const opponentGames = Math.max(1, opponentRecord.wins + opponentRecord.losses);
    const managedPct = managedRecord.wins / managedGames;
    const opponentPct = opponentRecord.wins / opponentGames;
    score += (managedPct - opponentPct) * 40;
  }

  const managedLast = lastResultByShort.get(managedShort);
  const opponentLast = lastResultByShort.get(opponentShort);
  if (managedLast === 'W') score += 4;
  if (managedLast === 'L') score -= 4;
  if (opponentLast === 'W') score -= 4;
  if (opponentLast === 'L') score += 4;

  score += isHome ? 5 : -5;

  return Math.round(Math.max(15, Math.min(85, score)));
}

function HomeAwayPill({ isHome, venue }) {
  return (
    <div className={`matches-venue ${isHome ? 'is-home' : 'is-away'}`}>
      <strong>{isHome ? 'Home' : 'Away'}</strong>
      <span>{venue}</span>
    </div>
  );
}

function TeamBadge({ team, recordText }) {
  const alt = `${team?.shortName || 'Team'} logo`;
  return (
    <div className="matches-team-badge">
      <div className="matches-team-logo-wrap">
        <img
          className="matches-team-logo"
          src={logoPath(team)}
          alt={alt}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling;
            if (fallback) fallback.style.display = 'grid';
          }}
        />
        <div className="matches-team-fallback">{initials(team)}</div>
      </div>
      <div>
        <h4>{team?.name || team?.shortName || 'Team'}</h4>
        <p>{recordText || safeRecord(team)}</p>
      </div>
    </div>
  );
}

export function Matches() {
  const {
    currentSave,
    scheduleGames,
    results,
    standings,
    teams,
    fetchSchedule,
    fetchResults,
    fetchStandings,
    fetchTeams,
    loading,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState(TAB_UPCOMING);

  useEffect(() => {
    fetchSchedule();
    fetchResults();
    fetchStandings();
    fetchTeams();
  }, [fetchSchedule, fetchResults, fetchStandings, fetchTeams]);

  const managedTeamShort = String(currentSave?.data?.career?.teamShortName || '').toUpperCase();
  const currentDateKey = currentSave?.data?.currentDate || null;

  const upcomingMatches = useMemo(() => {
    return (scheduleGames || [])
      .filter((game) => !isFixtureCompleted(game))
      .map((game) => toMatchView(game, managedTeamShort))
      .filter(Boolean)
      .filter((entry) => {
        const key = getFixtureDateKeyEt(entry.game.gameDate);
        if (!key || !currentDateKey) return true;
        return key >= currentDateKey;
      })
      .sort((a, b) => new Date(a.game.gameDate) - new Date(b.game.gameDate));
  }, [scheduleGames, managedTeamShort, currentDateKey]);

  const recentResults = useMemo(() => {
    return (results || [])
      .map((game) => toMatchView(game, managedTeamShort))
      .filter(Boolean)
      .sort((a, b) => new Date(b.game.gameDate) - new Date(a.game.gameDate));
  }, [results, managedTeamShort]);

  const nextMatchDays = upcomingMatches[0]
    ? daysUntilGame(upcomingMatches[0].game.gameDate, currentDateKey)
    : null;

  const teamFallbackRecordMap = useMemo(() => {
    const map = new Map();
    for (const team of teams || []) {
      const key = String(team?.shortName || '').toUpperCase();
      if (!key) continue;
      const parsed = normalizeRecord({ wins: team?.wins, losses: team?.losses });
      if (parsed) map.set(key, parsed);
    }
    return map;
  }, [teams]);

  const standingsRecordMap = useMemo(() => {
    const map = new Map();
    const combined = [...(standings?.east || []), ...(standings?.west || [])];
    for (const row of combined) {
      const key = String(row?.shortName || '').toUpperCase();
      if (!key) continue;
      const parsed = normalizeRecord({ wins: row?.wins, losses: row?.losses });
      if (parsed) map.set(key, parsed);
    }
    return map;
  }, [standings]);

  const resultsRecordMap = useMemo(() => {
    const map = new Map();
    for (const game of results || []) {
      if (!isFixtureCompleted(game)) continue;
      const homeShort = String(game.homeTeam?.shortName || '').toUpperCase();
      const awayShort = String(game.awayTeam?.shortName || '').toUpperCase();
      const homeScore = Number(game.homeScore ?? 0);
      const awayScore = Number(game.awayScore ?? 0);
      if (!homeShort || !awayShort) continue;

      if (!map.has(homeShort)) map.set(homeShort, { wins: 0, losses: 0 });
      if (!map.has(awayShort)) map.set(awayShort, { wins: 0, losses: 0 });

      if (homeScore >= awayScore) {
        map.get(homeShort).wins += 1;
        map.get(awayShort).losses += 1;
      } else {
        map.get(awayShort).wins += 1;
        map.get(homeShort).losses += 1;
      }
    }
    return map;
  }, [results]);

  const teamRecordMap = useMemo(() => {
    const allKeys = new Set([
      ...standingsRecordMap.keys(),
      ...resultsRecordMap.keys(),
      ...teamFallbackRecordMap.keys(),
    ]);
    const map = new Map();
    for (const key of allKeys) {
      map.set(
        key,
        standingsRecordMap.get(key)
        || resultsRecordMap.get(key)
        || teamFallbackRecordMap.get(key)
        || null
      );
    }
    return map;
  }, [standingsRecordMap, resultsRecordMap, teamFallbackRecordMap]);

  const rankingByShort = useMemo(() => {
    const combined = [...(standings?.east || []), ...(standings?.west || [])];
    const sorted = [...combined].sort((a, b) => {
      const pctDiff = Number(b?.pct ?? 0) - Number(a?.pct ?? 0);
      if (pctDiff !== 0) return pctDiff;
      return Number(b?.wins ?? 0) - Number(a?.wins ?? 0);
    });
    const map = new Map();
    sorted.forEach((row, idx) => {
      const key = String(row?.shortName || '').toUpperCase();
      if (key) map.set(key, idx + 1);
    });
    return map;
  }, [standings]);

  const lastResultByShort = useMemo(() => {
    const sorted = [...(results || [])].sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
    const map = new Map();
    for (const game of sorted) {
      if (!isFixtureCompleted(game)) continue;
      const homeShort = String(game.homeTeam?.shortName || '').toUpperCase();
      const awayShort = String(game.awayTeam?.shortName || '').toUpperCase();
      if (homeShort && !map.has(homeShort)) {
        map.set(homeShort, didTeamWin(game, homeShort) ? 'W' : 'L');
      }
      if (awayShort && !map.has(awayShort)) {
        map.set(awayShort, didTeamWin(game, awayShort) ? 'W' : 'L');
      }
      if (map.size >= 30) break;
    }
    return map;
  }, [results]);

  const recordText = (team) => {
    const key = String(team?.shortName || '').toUpperCase();
    if (!key) return 'Record N/A';
    const record = teamRecordMap.get(key);
    if (!record) return 'Record N/A';
    return `${record.wins}-${record.losses}`;
  };

  const formList = useMemo(
    () => buildForm(results || [], managedTeamShort, 5),
    [results, managedTeamShort]
  );

  if (loading && scheduleGames.length === 0) return <SkeletonCard />;

  return (
    <div className="matches-page matches-v2">
      <section className="matches-hero">
        <div>
          <h1>FIXTURES &amp; RESULTS</h1>
          <p>View upcoming matches and recent results</p>
        </div>
        <div className="matches-next-chip">
          <span>NEXT MATCH</span>
          <strong>{Number.isFinite(nextMatchDays) ? `${nextMatchDays} days` : '-'}</strong>
        </div>
      </section>

      <div className="matches-tabbar">
        <button
          type="button"
          className={activeTab === TAB_UPCOMING ? 'active' : ''}
          onClick={() => setActiveTab(TAB_UPCOMING)}
        >
          Upcoming Fixtures
        </button>
        <button
          type="button"
          className={activeTab === TAB_RESULTS ? 'active' : ''}
          onClick={() => setActiveTab(TAB_RESULTS)}
        >
          Recent Results
        </button>
      </div>

      {activeTab === TAB_UPCOMING ? (
        <section className="matches-section">
          <div className="matches-section-head">
            <h2>Upcoming Fixtures</h2>
            <span>{upcomingMatches.length} matches scheduled</span>
          </div>

          {upcomingMatches.length === 0 ? (
            <EmptyState title="No upcoming fixtures" description="Advance the season or load another save to see upcoming team games." />
          ) : (
            <>
              <div className="matches-feature-list">
                {upcomingMatches.slice(0, 3).map((entry, index) => {
                  const { game, isHome, managedTeam, opponentTeam } = entry;
                  const importance = buildImportanceTone(index);
                  const h2hWin = hashMetric(`h2h-${game.id}`, 98, 124);
                  const h2hLose = hashMetric(`h2h2-${game.id}`, 90, 110);
                  const prediction = computePrediction({
                    managedShort: String(managedTeam?.shortName || '').toUpperCase(),
                    opponentShort: String(opponentTeam?.shortName || '').toUpperCase(),
                    isHome,
                    rankingByShort,
                    recordByShort: teamRecordMap,
                    lastResultByShort,
                  });
                  const venueName = isHome ? `${managedTeam?.name || managedTeam?.shortName} Arena` : `${opponentTeam?.name || opponentTeam?.shortName} Arena`;

                  return (
                    <article key={game.id} className={`matches-feature-card tone-${importance.tone}`}>
                      <div className="matches-feature-main">
                        <div className="matches-date-pill">
                          <span>{formatFixtureDate(game.gameDate)}</span>
                          <strong>{formatFixtureDateTime(game.gameDate).split(', ')[1] || ''}</strong>
                        </div>

                        <TeamBadge team={managedTeam} recordText={recordText(managedTeam)} />

                        <div className="matches-versus">VS</div>

                        <TeamBadge team={opponentTeam} recordText={recordText(opponentTeam)} />

                        <div className="matches-actions">
                          <HomeAwayPill isHome={isHome} venue={venueName} />
                          <button type="button" className="matches-primary-btn" onClick={() => { window.location.hash = `prepare?gameId=${game.id}`; }}>Prepare</button>
                        </div>
                      </div>

                      <div className="matches-feature-stats">
                        <div>
                          <small>FORM</small>
                          <p className="matches-form-row">
                            {formList.length ? formList.map((result, idx) => (
                              <span key={`${game.id}-form-${idx}`} className={result === 'W' ? 'is-win' : 'is-loss'}>{result}</span>
                            )) : <span className="is-empty">No data</span>}
                          </p>
                        </div>
                        <div>
                          <small>H2H LAST</small>
                          <p className="matches-h2h">W {h2hWin}-{h2hLose}</p>
                        </div>
                        <div>
                          <small>IMPORTANCE</small>
                          <p className={`matches-importance ${importance.tone}`}>{importance.label}</p>
                        </div>
                        <div>
                          <small>PREDICTION</small>
                          <p className="matches-prediction">{prediction}% Win</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="matches-mini-grid">
                {upcomingMatches.slice(3, 7).map((entry) => (
                  <article key={entry.game.id} className="matches-mini-card">
                    <div className="matches-mini-left">
                      <div className="matches-mini-avatar">
                        <img
                          className="matches-mini-logo"
                          src={logoPath(entry.opponentTeam)}
                          alt={`${entry.opponentTeam?.shortName || 'Team'} logo`}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = 'grid';
                          }}
                        />
                        <span className="matches-mini-fallback">{initials(entry.opponentTeam)}</span>
                      </div>
                      <div>
                        <h5>{entry.opponentTeam?.name || entry.opponentTeam?.shortName}</h5>
                        <p>
                          {formatFixtureDate(entry.game.gameDate)}{' '}
                          <strong>{entry.isHome ? 'Home' : 'Away'}</strong>
                        </p>
                      </div>
                    </div>
                    <button type="button" className="matches-view-btn" onClick={() => { window.location.hash = `prepare?gameId=${entry.game.id}`; }}>View</button>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="matches-section">
          <div className="matches-section-head">
            <h2>Recent Results</h2>
            <span>{recentResults.length} matches played</span>
          </div>

          {recentResults.length === 0 ? (
            <EmptyState title="No recent results" description="Play or simulate matches to populate the latest results list." />
          ) : (
            <div className="matches-feature-list">
              {recentResults.slice(0, 5).map((entry) => {
                const { game, isHome, managedTeam, opponentTeam } = entry;
                const myScore = isHome ? Number(game.homeScore ?? 0) : Number(game.awayScore ?? 0);
                const oppScore = isHome ? Number(game.awayScore ?? 0) : Number(game.homeScore ?? 0);
                const win = myScore >= oppScore;
                const fg = (hashMetric(`fg-${game.id}`, 44, 55) / 10).toFixed(1);
                const tpt = (hashMetric(`3pt-${game.id}`, 30, 44) / 10).toFixed(1);
                const rebounds = hashMetric(`reb-${game.id}`, 36, 55);
                const assists = hashMetric(`ast-${game.id}`, 20, 33);
                const topScorer = currentSave?.data?.career?.coachName ? `${currentSave.data.career.coachName.split(' ')[0]} ${hashMetric(`pts-${game.id}`, 24, 38)}` : `Top ${hashMetric(`pts-${game.id}`, 24, 38)}`;

                return (
                  <article key={game.id} className="matches-feature-card tone-success">
                    <div className="matches-feature-main">
                      <div className={`matches-result-pill ${win ? 'is-win' : 'is-loss'}`}>
                        <strong>{win ? 'W' : 'L'}</strong>
                        <span>Final</span>
                      </div>

                      <div className="matches-date-context">
                        <span>{formatFixtureDate(game.gameDate)}</span>
                        <strong>{isHome ? 'Home' : 'Away'}</strong>
                      </div>

                      <TeamBadge team={managedTeam} recordText={recordText(managedTeam)} />

                      <div className="matches-score-box">
                        <strong>{myScore}</strong>
                        <span>-</span>
                        <strong>{oppScore}</strong>
                      </div>

                      <TeamBadge team={opponentTeam} recordText={recordText(opponentTeam)} />

                      <button type="button" className="matches-report-btn" onClick={() => { window.location.hash = `results?matchId=${game.id}`; }}>Match Report</button>
                    </div>

                    <div className="matches-feature-stats">
                      <div>
                        <small>FG%</small>
                        <p>{fg}%</p>
                      </div>
                      <div>
                        <small>3PT%</small>
                        <p>{tpt}%</p>
                      </div>
                      <div>
                        <small>REBOUNDS</small>
                        <p>{rebounds}</p>
                      </div>
                      <div>
                        <small>ASSISTS</small>
                        <p>{assists}</p>
                      </div>
                      <div>
                        <small>TOP SCORER</small>
                        <p className="matches-top-scorer">{topScorer}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

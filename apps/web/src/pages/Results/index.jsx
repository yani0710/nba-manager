import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader } from '../../components/ui';
import { formatFixtureDate } from '../../domain/fixtures';
import '../Matches.css';
import './Results.css';

const TAB_TEAM = 'team';
const TAB_BOX = 'box';
const TAB_QTR = 'qtr';

const logoPath = (team) => {
  const short = (team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
};

const initials = (team) => String(team?.shortName || 'NBA').slice(0, 3).toUpperCase();
const playerInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const hashUnit = (seed) => {
  const text = String(seed || 'seed');
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

const hashMetric = (seed, min, max) => Math.round(min + (max - min) * hashUnit(seed));

const pct = (made, attempts) => {
  const att = Number(attempts || 0);
  if (!att) return 0;
  return (Number(made || 0) / att) * 100;
};

const pctText = (value) => `${Number(value || 0).toFixed(1)}%`;

const minutesValue = (value) => {
  if (Number.isFinite(Number(value))) return Number(value);
  if (typeof value !== 'string') return 0;
  const [mins = '0'] = value.split(':');
  return Number(mins) || 0;
};

const getView = (game, teamShort) => {
  const homeShort = String(game.homeTeam?.shortName || '').toUpperCase();
  const awayShort = String(game.awayTeam?.shortName || '').toUpperCase();
  const isHome = homeShort === teamShort;
  const isAway = awayShort === teamShort;
  if (!isHome && !isAway) return null;
  const myScore = Number(isHome ? game.homeScore : game.awayScore);
  const oppScore = Number(isHome ? game.awayScore : game.homeScore);
  return { isHome, myScore, oppScore, win: myScore >= oppScore, me: isHome ? game.homeTeam : game.awayTeam, opp: isHome ? game.awayTeam : game.homeTeam };
};

const quarterBreakdown = (game, details) => {
  const split = (total, seed) => {
    const base = [0.24, 0.26, 0.25, 0.25].map((n, i) => n + (hashUnit(`${seed}-${i}`) - 0.5) * 0.08);
    const sum = base.reduce((s, n) => s + n, 0);
    const arr = base.map((n) => Math.floor((n / sum) * total));
    let left = total - arr.reduce((s, n) => s + n, 0);
    let idx = 0;
    while (left > 0) {
      arr[idx % 4] += 1;
      left -= 1;
      idx += 1;
    }
    return arr;
  };
  const homeTotal = Number(details?.homeScore ?? game.homeScore ?? 0);
  const awayTotal = Number(details?.awayScore ?? game.awayScore ?? 0);
  const h = split(homeTotal, `home-${game.id}`);
  const a = split(awayTotal, `away-${game.id}`);
  return [
    { label: 'Q1', home: h[0], away: a[0] },
    { label: 'Q2', home: h[1], away: a[1] },
    { label: 'Q3', home: h[2], away: a[2] },
    { label: 'Q4', home: h[3], away: a[3] },
    { label: 'TOTAL', home: homeTotal, away: awayTotal },
  ];
};

export function Results() {
  const { currentSave, results, players, fetchResults, fetchPlayers, fetchResultDetails } = useGameStore();
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [detailsById, setDetailsById] = useState({});
  const [tabById, setTabById] = useState({});
  const [boxTeamById, setBoxTeamById] = useState({});
  const teamShort = String(currentSave?.data?.career?.teamShortName || '').toUpperCase();

  useEffect(() => { fetchResults(); }, [fetchResults]);
  useEffect(() => { if (currentSave?.id) fetchPlayers(); }, [fetchPlayers, currentSave?.id]);

  const loadDetails = async (game) => {
    if (!game || detailsById[game.id]) return detailsById[game.id] || null;
    const details = await fetchResultDetails(game.id);
    if (!details) return null;
    setDetailsById((prev) => ({ ...prev, [game.id]: details }));
    setTabById((prev) => ({ ...prev, [game.id]: prev[game.id] || TAB_TEAM }));
    setBoxTeamById((prev) => ({ ...prev, [game.id]: prev[game.id] || details.homeTeam?.shortName }));
    return details;
  };

  useEffect(() => {
    const fromHash = async () => {
      const hash = String(window.location.hash || '');
      const [, query = ''] = hash.split('?');
      const id = new URLSearchParams(query).get('matchId');
      if (!id) return;
      const game = (results || []).find((item) => String(item.id) === String(id));
      if (!game) return;
      setExpanded(game.id);
      await loadDetails(game);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [results]);

  const managedResults = useMemo(() => (results || []).map((g) => ({ game: g, view: getView(g, teamShort) })).filter((row) => row.view), [results, teamShort]);
  const wins = managedResults.filter((row) => row.view.win).length;
  const losses = managedResults.length - wins;
  const filtered = managedResults.filter((row) => (filter === 'wins' ? row.view.win : filter === 'losses' ? !row.view.win : true));
  const avgFor = managedResults.length ? managedResults.reduce((sum, row) => sum + row.view.myScore, 0) / managedResults.length : 0;
  const avgAgainst = managedResults.length ? managedResults.reduce((sum, row) => sum + row.view.oppScore, 0) / managedResults.length : 0;
  const pointDiff = avgFor - avgAgainst;
  const homeGames = managedResults.filter((row) => row.view.isHome);
  const awayGames = managedResults.filter((row) => !row.view.isHome);
  const homeWins = homeGames.filter((row) => row.view.win).length;
  const awayWins = awayGames.filter((row) => row.view.win).length;
  const winRate = managedResults.length ? (wins / managedResults.length) * 100 : 0;
  const streak = useMemo(() => {
    let count = 0;
    let mode = null;
    for (const row of managedResults) {
      const value = row.view.win ? 'W' : 'L';
      if (!mode) mode = value;
      if (mode !== value) break;
      count += 1;
    }
    return mode ? `${mode}${count}` : '-';
  }, [managedResults]);

  return (
    <div className="matches-page results-page">
      <PageHeader title="MATCH RESULTS" subtitle="View your team's match history and detailed performance statistics." />

      <section className="results-top-grid">
        <article className="results-top-card">
          <h4>Record</h4>
          <p>{wins}-{losses}</p>
          <small>{pctText(winRate)}</small>
        </article>
        <article className="results-top-card">
          <h4>Current Streak</h4>
          <p className={String(streak).startsWith('W') ? 'is-green' : 'is-red'}>{streak}</p>
          <small>{String(streak).startsWith('W') ? 'Winning streak' : 'Need bounce back'}</small>
        </article>
        <article className="results-top-card">
          <h4>Avg Points</h4>
          <p>{avgFor.toFixed(1)}</p>
          <small className="is-green">Per game</small>
        </article>
        <article className="results-top-card">
          <h4>Avg Against</h4>
          <p>{avgAgainst.toFixed(1)}</p>
          <small className="is-red">Per game</small>
        </article>
        <article className="results-top-card">
          <h4>Point Diff</h4>
          <p className={pointDiff >= 0 ? 'is-green' : 'is-red'}>{pointDiff >= 0 ? '+' : ''}{pointDiff.toFixed(1)}</p>
          <small>Per game</small>
        </article>
      </section>

      <section className="results-subtop-grid">
        <article className="results-subtop-card">
          <h4>Home Record</h4>
          <p>{homeWins}-{Math.max(0, homeGames.length - homeWins)}</p>
          <small>{homeGames.length ? pctText((homeWins / homeGames.length) * 100) : '0.0%'} win rate</small>
        </article>
        <article className="results-subtop-card">
          <h4>Away Record</h4>
          <p>{awayWins}-{Math.max(0, awayGames.length - awayWins)}</p>
          <small>{awayGames.length ? pctText((awayWins / awayGames.length) * 100) : '0.0%'} win rate</small>
        </article>
        <article className="results-subtop-card">
          <h4>Season Progress</h4>
          <p>{managedResults.length}/82</p>
          <small>{Math.max(0, 82 - managedResults.length)} games remaining</small>
        </article>
      </section>

      <section className="results-filter-row">
        <button type="button" className={`results-filter-btn ${filter === 'all' ? 'active is-all' : ''}`} onClick={() => setFilter('all')}>All Games ({managedResults.length})</button>
        <button type="button" className={`results-filter-btn ${filter === 'wins' ? 'active is-win' : ''}`} onClick={() => setFilter('wins')}>Wins ({wins})</button>
        <button type="button" className={`results-filter-btn ${filter === 'losses' ? 'active is-loss' : ''}`} onClick={() => setFilter('losses')}>Losses ({losses})</button>
      </section>

      {filtered.length === 0 && <EmptyState title="No completed matches" description="Advance the schedule to generate final results." />}

      {filtered.map(({ game, view }) => {
        const open = expanded === game.id;
        const details = detailsById[game.id] || null;
        const tab = tabById[game.id] || TAB_TEAM;
        const boxTeam = boxTeamById[game.id] || details?.homeTeam?.shortName;
        const home = details?.basicStats?.home;
        const away = details?.basicStats?.away;
        const statRows = (details?.players || []).filter((p) => String(p.teamShortName || '').toUpperCase() === String(boxTeam || '').toUpperCase());
        const statByPlayerId = new Map(statRows.map((row) => [Number(row.playerId), row]));
        const rosterRows = (players || [])
          .filter((p) => String(p.team?.shortName || '').toUpperCase() === String(boxTeam || '').toUpperCase())
          .map((p) => ({
            playerId: p.id,
            teamShortName: boxTeam,
            name: p.name,
            minutes: 0,
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            twoPtMade: 0,
            twoPtAtt: 0,
            threePtMade: 0,
            threePtAtt: 0,
            ftMade: 0,
            ftAtt: 0,
            turnovers: 0,
            fouls: 0,
          }));
        const mergedRows = rosterRows.map((row) => ({ ...row, ...(statByPlayerId.get(Number(row.playerId)) || {}) }));
        for (const row of statRows) {
          if (!mergedRows.some((item) => Number(item.playerId) === Number(row.playerId))) {
            mergedRows.push(row);
          }
        }
        const sortedRows = mergedRows.sort((a, b) => (minutesValue(b.minutes) - minutesValue(a.minutes)) || ((b.points ?? 0) - (a.points ?? 0)) || String(a.name || '').localeCompare(String(b.name || '')));
        const qtrs = quarterBreakdown(game, details || game);
        const attendance = hashMetric(`att-${game.id}`, 17000, 19999).toLocaleString('en-US');
        const fg = details ? pctText(pct((view.isHome ? home : away)?.twoPtMade + (view.isHome ? home : away)?.threePtMade, (view.isHome ? home : away)?.twoPtAtt + (view.isHome ? home : away)?.threePtAtt)) : `${(hashMetric(`fg-${game.id}`, 435, 535) / 10).toFixed(1)}%`;
        const three = details ? pctText(pct((view.isHome ? home : away)?.threePtMade, (view.isHome ? home : away)?.threePtAtt)) : `${(hashMetric(`3-${game.id}`, 330, 440) / 10).toFixed(1)}%`;
        const rebs = (view.isHome ? home : away)?.rebounds ?? hashMetric(`reb-${game.id}`, 40, 56);
        const scorer = details?.topScorer ? `${details.topScorer.name} ${details.topScorer.points} PTS` : `Top scorer ${hashMetric(`pts-${game.id}`, 24, 38)} PTS`;
        const leftScore = Number(view.myScore ?? 0);
        const rightScore = Number(view.oppScore ?? 0);

        return (
          <article key={game.id} className={`results-game-card ${view.win ? 'is-win' : 'is-loss'}`}>
            <div className="results-game-head">
              <div><strong>{formatFixtureDate(game.gameDate)}</strong> <small>{view.isHome ? 'HOME' : 'AWAY'}</small></div>
              <div className={`results-outcome-pill ${view.win ? 'is-win' : 'is-loss'}`}>{view.win ? 'WIN' : 'LOSS'}</div>
            </div>
            <div className="results-game-main">
              <div className="results-team-side"><div className="results-team-logo-wrap"><img src={logoPath(view.me)} alt={view.me?.shortName} className="results-team-logo" onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling; if (f) f.style.display = 'grid'; }} /><span className="results-team-fallback">{initials(view.me)}</span></div><div><h3>{view.me?.name || view.me?.shortName}</h3><p>{view.isHome ? 'Home' : 'Away'}</p></div></div>
              <div className="results-scoreline">
                <strong className={leftScore >= rightScore ? 'is-leading' : ''}>{leftScore}</strong>
                <strong className={rightScore > leftScore ? 'is-leading' : ''}>{rightScore}</strong>
              </div>
              <div className="results-team-side is-opponent"><div><h3>{view.opp?.name || view.opp?.shortName}</h3><p>{view.isHome ? 'Away' : 'Home'}</p></div><div className="results-team-logo-wrap"><img src={logoPath(view.opp)} alt={view.opp?.shortName} className="results-team-logo" onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling; if (f) f.style.display = 'grid'; }} /><span className="results-team-fallback">{initials(view.opp)}</span></div></div>
            </div>
            <div className="results-metric-row"><div className="results-metric"><small>Top Scorer</small><strong>{scorer}</strong></div><div className="results-metric"><small>FG%</small><strong>{fg}</strong></div><div className="results-metric"><small>3PT%</small><strong>{three}</strong></div><div className="results-metric"><small>Rebounds</small><strong>{rebs}</strong></div><div className="results-metric"><small>Attendance</small><strong>{attendance}</strong></div></div>
            <button type="button" className="results-expand-btn" onClick={async () => { if (open) { setExpanded(null); window.location.hash = 'results'; return; } setExpanded(game.id); window.location.hash = `results?matchId=${game.id}`; await loadDetails(game); }}>{open ? 'Hide Full Stats' : 'View Full Stats'}</button>

            {open && details && (
              <div className="results-full-stats">
                <div className="results-full-tabs">
                  <button type="button" className={tab === TAB_TEAM ? 'active' : ''} onClick={() => setTabById((prev) => ({ ...prev, [game.id]: TAB_TEAM }))}>Team Stats</button>
                  <button type="button" className={tab === TAB_BOX ? 'active' : ''} onClick={() => setTabById((prev) => ({ ...prev, [game.id]: TAB_BOX }))}>Box Score</button>
                  <button type="button" className={tab === TAB_QTR ? 'active' : ''} onClick={() => setTabById((prev) => ({ ...prev, [game.id]: TAB_QTR }))}>Quarter Breakdown</button>
                </div>

                {tab === TAB_TEAM && (
                  <div className="results-team-stats-layout">
                    <div className="results-team-stat-panel"><h4>{details.homeTeam?.shortName} Stats</h4><p>FG% {pctText(pct((home?.twoPtMade ?? 0) + (home?.threePtMade ?? 0), (home?.twoPtAtt ?? 0) + (home?.threePtAtt ?? 0)))}</p><p>3PT% {pctText(pct(home?.threePtMade, home?.threePtAtt))}</p><p>FT% {pctText(pct(home?.ftMade, home?.ftAtt))}</p><p>REB {home?.rebounds ?? 0} | AST {home?.assists ?? 0} | TO {home?.turnovers ?? 0}</p></div>
                    <div className="results-team-stat-panel"><h4>{details.awayTeam?.shortName} Stats</h4><p>FG% {pctText(pct((away?.twoPtMade ?? 0) + (away?.threePtMade ?? 0), (away?.twoPtAtt ?? 0) + (away?.threePtAtt ?? 0)))}</p><p>3PT% {pctText(pct(away?.threePtMade, away?.threePtAtt))}</p><p>FT% {pctText(pct(away?.ftMade, away?.ftAtt))}</p><p>REB {away?.rebounds ?? 0} | AST {away?.assists ?? 0} | TO {away?.turnovers ?? 0}</p></div>
                  </div>
                )}

                {tab === TAB_BOX && (
                  <div className="results-boxscore-panel">
                    <div className="results-boxscore-team-switch">
                      <button type="button" className={boxTeam === details.homeTeam?.shortName ? 'active' : ''} onClick={() => setBoxTeamById((prev) => ({ ...prev, [game.id]: details.homeTeam?.shortName }))}>{details.homeTeam?.shortName} Players</button>
                      <button type="button" className={boxTeam === details.awayTeam?.shortName ? 'active' : ''} onClick={() => setBoxTeamById((prev) => ({ ...prev, [game.id]: details.awayTeam?.shortName }))}>{details.awayTeam?.shortName} Players</button>
                    </div>
                    <div className="ui-table-shell">
                      <table className="ui-table results-boxscore-table">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th className="ui-num">MIN</th>
                            <th className="ui-num">PTS</th>
                            <th className="ui-num">REB</th>
                            <th className="ui-num">AST</th>
                            <th className="ui-num">STL</th>
                            <th className="ui-num">BLK</th>
                            <th className="ui-num">FG</th>
                            <th className="ui-num">3PT</th>
                            <th className="ui-num">FT</th>
                            <th className="ui-num">TO</th>
                            <th className="ui-num">PF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRows.length === 0 ? (
                            <tr><td colSpan={12}>No player stats available.</td></tr>
                          ) : sortedRows.map((p) => (
                            <tr key={`${p.playerId}-${p.teamShortName}`}>
                              <td>
                                <div className="results-player-cell">
                                  <span className="results-player-badge">{playerInitials(p.name)}</span>
                                  <strong>{p.name}</strong>
                                </div>
                              </td>
                              <td className="ui-num">{minutesValue(p.minutes)}</td>
                              <td className="ui-num results-points-cell">{p.points ?? 0}</td>
                              <td className="ui-num">{p.rebounds ?? 0}</td>
                              <td className="ui-num">{p.assists ?? 0}</td>
                              <td className="ui-num">{p.steals ?? 0}</td>
                              <td className="ui-num">{p.blocks ?? 0}</td>
                              <td className="ui-num">{(p.twoPtMade ?? 0) + (p.threePtMade ?? 0)}-{(p.twoPtAtt ?? 0) + (p.threePtAtt ?? 0)}</td>
                              <td className="ui-num">{p.threePtMade ?? 0}-{p.threePtAtt ?? 0}</td>
                              <td className="ui-num">{p.ftMade ?? 0}-{p.ftAtt ?? 0}</td>
                              <td className="ui-num">{p.turnovers ?? 0}</td>
                              <td className="ui-num">{p.fouls ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tab === TAB_QTR && (
                  <div className="results-quarter-grid">{qtrs.map((q) => <div key={`${game.id}-${q.label}`} className="results-quarter-card"><span>{q.label}</span><p>{details.homeTeam?.shortName}: <strong>{q.home}</strong></p><p>{details.awayTeam?.shortName}: <strong>{q.away}</strong></p></div>)}</div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

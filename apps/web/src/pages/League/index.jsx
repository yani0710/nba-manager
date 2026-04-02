import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonTable } from '../../components/ui';
import '../League.css';

const VIEW_FULL = 'full';
const VIEW_PLAYOFF = 'playoff';
const VIEW_DIVISION = 'division';

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const logoPath = (team, fallbackShort) => {
  const short = (team?.shortName || fallbackShort || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
};

const teamInitial = (short) => String(short || 'TM').slice(0, 3).toUpperCase();

const parseStreak = (streak) => {
  const text = String(streak || '-').toUpperCase();
  const type = text.startsWith('W') ? 'W' : text.startsWith('L') ? 'L' : '-';
  const count = Number(text.slice(1)) || 0;
  return { type, count };
};

const parseLast5 = (team, row) => {
  const raw = String(team?.last5 || '').toUpperCase().replace(/[^WL]/g, '');
  if (raw.length >= 5) return raw.slice(-5).split('');
  const { type, count } = parseStreak(row?.streak);
  if (type === '-') return ['W', 'W', 'L', 'W', 'L'];
  const seed = Array.from({ length: 5 }, (_, i) => (i < Math.min(5, count) ? type : (type === 'W' ? 'L' : 'W')));
  return seed.reverse();
};

const remainingGames = (row) => Math.max(0, 82 - (toNum(row?.wins) + toNum(row?.losses)));

function buildPlayoffStatus(rows) {
  const rank10 = rows[9];
  const rank11 = rows[10];
  const rank10Wins = toNum(rank10?.wins, 0);
  const rank11MaxWins = rank11 ? (toNum(rank11.wins, 0) + remainingGames(rank11)) : -1;

  return rows.map((row, idx) => {
    const rank = idx + 1;
    const maxWins = toNum(row.wins, 0) + remainingGames(row);
    const clinched = rank <= 10 && toNum(row.wins, 0) > rank11MaxWins;
    const eliminated = rank > 10 && maxWins < rank10Wins;
    const inPosition = !clinched && !eliminated && rank <= 10;
    return { teamId: row.teamId, rank, clinched, inPosition, eliminated };
  });
}

export function League() {
  const { currentSave, standings, teams, fetchStandings, fetchTeams, loading } = useGameStore();
  const [conference, setConference] = useState('West');
  const [view, setView] = useState(VIEW_FULL);

  useEffect(() => {
    fetchStandings();
    fetchTeams();
  }, [fetchStandings, fetchTeams]);

  const managedShort = String(currentSave?.data?.career?.teamShortName || '').toUpperCase();
  const eastRows = standings?.east ?? [];
  const westRows = standings?.west ?? [];

  const teamByShort = useMemo(() => {
    const map = new Map();
    for (const team of teams || []) {
      const key = String(team?.shortName || '').toUpperCase();
      if (key) map.set(key, team);
    }
    return map;
  }, [teams]);

  const managedInWest = westRows.some((row) => String(row.shortName || '').toUpperCase() === managedShort);
  const managedInEast = eastRows.some((row) => String(row.shortName || '').toUpperCase() === managedShort);

  useEffect(() => {
    if (managedInWest) setConference('West');
    else if (managedInEast) setConference('East');
  }, [managedInWest, managedInEast]);

  const activeRows = conference === 'West' ? westRows : eastRows;
  const statusRows = useMemo(() => buildPlayoffStatus(activeRows), [activeRows]);
  const statusByTeamId = useMemo(() => new Map(statusRows.map((item) => [item.teamId, item])), [statusRows]);

  const managedRow = useMemo(() => {
    const all = [...westRows, ...eastRows];
    return all.find((row) => String(row.shortName || '').toUpperCase() === managedShort) || null;
  }, [westRows, eastRows, managedShort]);

  const managedConferenceRows = useMemo(() => {
    if (!managedRow) return activeRows;
    return managedRow.conference === 'East' ? eastRows : westRows;
  }, [managedRow, eastRows, westRows, activeRows]);

  const managedConferenceRank = useMemo(() => {
    if (!managedRow) return null;
    const idx = managedConferenceRows.findIndex((row) => row.teamId === managedRow.teamId);
    return idx >= 0 ? idx + 1 : null;
  }, [managedRow, managedConferenceRows]);

  const managedStatus = managedRow ? statusByTeamId.get(managedRow.teamId) : null;

  const playoffChance = useMemo(() => {
    if (!managedRow || !managedConferenceRank) return 0;
    if (managedStatus?.clinched) return 98.5;
    if (managedStatus?.eliminated) return 6.0;
    const base = 88 - Math.max(0, managedConferenceRank - 6) * 9;
    const gapPenalty = Math.max(0, toNum(managedRow.gb, 0) - 6) * 2.4;
    return Math.max(12, Math.min(97, Number((base - gapPenalty).toFixed(1))));
  }, [managedRow, managedConferenceRank, managedStatus]);

  const leaders = useMemo(() => {
    const bestRecord = activeRows[0] || null;
    let hot = null;
    for (const row of activeRows) {
      const s = parseStreak(row.streak);
      if (!hot || s.count > hot.count) {
        hot = { row, count: s.count, type: s.type };
      }
    }
    const clinchedCount = statusRows.filter((item) => item.clinched).length;
    return { bestRecord, hot, clinchedCount };
  }, [activeRows, statusRows]);

  const keyMatchups = useMemo(() => {
    if (!managedRow || !managedConferenceRank) return [];
    const above = managedConferenceRows[managedConferenceRank - 2] || null;
    const below = managedConferenceRows[managedConferenceRank] || null;
    const out = [];
    if (above) {
      out.push({
        text: `Next: vs ${above.shortName}`,
        sub: `Win to close gap to ${toNum(above.gb, 0) - toNum(managedRow.gb, 0)} GB`,
        tone: Math.abs(toNum(above.gb, 0) - toNum(managedRow.gb, 0)) <= 2 ? 'critical' : 'high',
      });
    }
    if (below) {
      out.push({
        text: `@ ${below.shortName}`,
        sub: 'Head-to-head for seeding',
        tone: Math.abs(toNum(below.gb, 0) - toNum(managedRow.gb, 0)) <= 2 ? 'high' : 'medium',
      });
    }
    return out;
  }, [managedRow, managedConferenceRows, managedConferenceRank]);

  const conferenceStrength = useMemo(() => {
    const avg = (rows) => {
      if (!rows.length) return 0;
      const total = rows.reduce((sum, row) => sum + toNum(row.pct, 0), 0);
      return Number(((total / rows.length) * 100).toFixed(1));
    };
    return { west: avg(westRows), east: avg(eastRows) };
  }, [eastRows, westRows]);

  const recentFormRows = useMemo(() => activeRows.slice(0, 8), [activeRows]);

  const divisionGroups = useMemo(() => {
    const groups = new Map();
    for (const row of activeRows) {
      const key = String(row.division || 'Unknown');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    for (const [, rows] of groups.entries()) {
      rows.sort((a, b) => b.pct - a.pct || b.wins - a.wins || a.losses - b.losses);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeRows]);

  const renderMainView = () => {
    if (view === VIEW_PLAYOFF) {
      const top6 = activeRows.slice(0, 6);
      const playIn = activeRows.slice(6, 10);
      const out = activeRows.slice(10);
      return (
        <div className="league-playoff-grid">
          <article className="league-slice-card">
            <h3>Top 6 Seeds</h3>
            {top6.map((row, idx) => <div key={row.teamId} className="league-slice-row"><span>{idx + 1}. {row.shortName}</span><b>{row.wins}-{row.losses}</b></div>)}
          </article>
          <article className="league-slice-card">
            <h3>Play-In (7-10)</h3>
            {playIn.map((row, idx) => <div key={row.teamId} className="league-slice-row"><span>{idx + 7}. {row.shortName}</span><b>{row.wins}-{row.losses}</b></div>)}
          </article>
          <article className="league-slice-card">
            <h3>Outside Looking In</h3>
            {out.map((row, idx) => <div key={row.teamId} className="league-slice-row"><span>{idx + 11}. {row.shortName}</span><b>{row.wins}-{row.losses}</b></div>)}
          </article>
        </div>
      );
    }

    if (view === VIEW_DIVISION) {
      return (
        <div className="league-division-grid">
          {divisionGroups.map(([division, rows]) => (
            <article key={division} className="league-slice-card">
              <h3>{division}</h3>
              {rows.map((row, idx) => (
                <div key={row.teamId} className={`league-slice-row ${String(row.shortName).toUpperCase() === managedShort ? 'is-managed' : ''}`}>
                  <span>{idx + 1}. {row.shortName}</span>
                  <b>{row.wins}-{row.losses} ({toNum(row.pct).toFixed(3)})</b>
                </div>
              ))}
            </article>
          ))}
        </div>
      );
    }

    return (
      <div className="ui-table-shell league-table-shell">
        <table className="ui-table league-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th className="ui-num">W</th>
              <th className="ui-num">L</th>
              <th className="ui-num">PCT</th>
              <th className="ui-num">GB</th>
              <th className="ui-num">Streak</th>
              <th className="ui-num">L10</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row, idx) => {
              const team = teamByShort.get(String(row.shortName || '').toUpperCase()) || null;
              const streak = parseStreak(row.streak);
              const me = String(row.shortName || '').toUpperCase() === managedShort;
              const status = statusByTeamId.get(row.teamId);
              return (
                <tr key={row.teamId} className={me ? 'is-managed' : ''}>
                  <td>
                    <div className="league-rank-cell">
                      <strong>{idx + 1}</strong>
                      <span className={`league-status-dot ${status?.clinched ? 'is-clinched' : status?.eliminated ? 'is-eliminated' : 'is-in'}`} />
                    </div>
                  </td>
                  <td>
                    <div className="league-team-cell">
                      <div className="league-team-logo-wrap">
                        <img src={logoPath(team, row.shortName)} alt={row.shortName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <span>{teamInitial(row.shortName)}</span>
                      </div>
                      <div>
                        <strong>{row.team}</strong>
                        {me ? <small>Your team</small> : null}
                      </div>
                    </div>
                  </td>
                  <td className="ui-num league-w">{row.wins}</td>
                  <td className="ui-num league-l">{row.losses}</td>
                  <td className="ui-num">{toNum(row.pct).toFixed(3)}</td>
                  <td className="ui-num">{idx === 0 ? '-' : toNum(row.gb).toFixed(1)}</td>
                  <td className="ui-num">
                    <span className={`league-streak-pill ${streak.type === 'W' ? 'is-win' : 'is-loss'}`}>{row.streak}</span>
                  </td>
                  <td className="ui-num">{row.l10 || '0-0'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading && activeRows.length === 0) return <SkeletonTable rows={12} cols={8} />;

  return (
    <div className="league-v3">
      <PageHeader
        title="LEAGUE STANDINGS"
        subtitle="Track conference rankings and playoff positioning"
        actions={(
          <div className="league-conference-toggle">
            <button type="button" className={conference === 'West' ? 'active is-west' : ''} onClick={() => setConference('West')}>Western</button>
            <button type="button" className={conference === 'East' ? 'active is-east' : ''} onClick={() => setConference('East')}>Eastern</button>
          </div>
        )}
      />

      <div className="league-view-tabs">
        <button type="button" className={view === VIEW_FULL ? 'active' : ''} onClick={() => setView(VIEW_FULL)}>Full Standings</button>
        <button type="button" className={view === VIEW_PLAYOFF ? 'active' : ''} onClick={() => setView(VIEW_PLAYOFF)}>Playoff Picture</button>
        <button type="button" className={view === VIEW_DIVISION ? 'active' : ''} onClick={() => setView(VIEW_DIVISION)}>Division View</button>
      </div>

      {activeRows.length === 0 ? (
        <EmptyState title="No standings yet" description="Simulate games to populate conference standings." />
      ) : (
        <>
          <section className="league-main-grid">
            <article className="league-main-card">
              <header className={`league-main-card-head ${conference === 'West' ? 'is-west' : 'is-east'}`}>
                <h2>{conference === 'West' ? 'Western Conference' : 'Eastern Conference'}</h2>
                <span>Playoff Position</span>
              </header>
              {renderMainView()}
              <footer className="league-main-card-foot">
                <span>Top 6 teams clinch playoff spots</span>
                <span>Remaining games affect seeding</span>
              </footer>
            </article>

            <aside className="league-side-stack">
              <article className="league-side-card league-side-highlight">
                <h3>Your Standing</h3>
                <p className="league-rank-big">{managedConferenceRank ? `${managedConferenceRank}${managedConferenceRank === 1 ? 'st' : managedConferenceRank === 2 ? 'nd' : managedConferenceRank === 3 ? 'rd' : 'th'}` : '-'}</p>
                <small>Conference Rank</small>
                <div className="league-side-dual">
                  <div><span>Games Back</span><b>{managedRow ? toNum(managedRow.gb).toFixed(1) : '-'}</b></div>
                  <div><span>Win %</span><b>{managedRow ? `${(toNum(managedRow.pct) * 100).toFixed(1)}%` : '-'}</b></div>
                </div>
              </article>

              <article className="league-side-card">
                <h3>Playoff Chances</h3>
                <p className="league-chance">{playoffChance.toFixed(1)}%</p>
                <div className="league-progress"><i style={{ width: `${playoffChance}%` }} /></div>
                <small>Based on current form and remaining schedule</small>
              </article>

              <article className="league-side-card">
                <h3>Conference Leaders</h3>
                <div className="league-lines">
                  <div><span>Best Record</span><b>{leaders.bestRecord ? `${leaders.bestRecord.team} (${leaders.bestRecord.wins}-${leaders.bestRecord.losses})` : '-'}</b></div>
                  <div><span>Hot Streak</span><b>{leaders.hot ? `${leaders.hot.row.team} (${leaders.hot.row.streak})` : '-'}</b></div>
                  <div><span>Clinched</span><b>{leaders.clinchedCount} Teams</b></div>
                </div>
              </article>

              <article className="league-side-card">
                <h3>Key Matchups</h3>
                <div className="league-matchups">
                  {keyMatchups.length === 0 ? <p>No key matchups right now.</p> : keyMatchups.map((item, idx) => (
                    <div key={`${item.text}-${idx}`}>
                      <div><span>{item.text}</span><b className={`is-${item.tone}`}>{item.tone.toUpperCase()}</b></div>
                      <small>{item.sub}</small>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>

          <section className="league-bottom-grid">
            <article className="league-side-card">
              <h3>Conference Strength Comparison</h3>
              <div className="league-strength-row">
                <span>Western Conference Avg Win %</span>
                <b>{conferenceStrength.west.toFixed(1)}%</b>
              </div>
              <div className="league-progress"><i className="is-purple" style={{ width: `${conferenceStrength.west}%` }} /></div>
              <div className="league-strength-row">
                <span>Eastern Conference Avg Win %</span>
                <b>{conferenceStrength.east.toFixed(1)}%</b>
              </div>
              <div className="league-progress"><i className="is-red" style={{ width: `${conferenceStrength.east}%` }} /></div>
            </article>

            <article className="league-side-card">
              <h3>Playoff Race Status</h3>
              <div className="league-race-grid">
                <div><i className="is-clinched">{statusRows.filter((item) => item.clinched).length}</i><span>Clinched</span></div>
                <div><i className="is-in">{statusRows.filter((item) => item.inPosition).length}</i><span>In Position</span></div>
                <div><i className="is-eliminated">{statusRows.filter((item) => item.eliminated).length}</i><span>Eliminated</span></div>
              </div>
            </article>
          </section>

          <section className="league-side-card league-form-card">
            <h3>Recent Form (Last 5 Games)</h3>
            <div className="league-form-list">
              {recentFormRows.map((row, idx) => {
                const team = teamByShort.get(String(row.shortName || '').toUpperCase()) || null;
                const chips = parseLast5(team, row);
                const me = String(row.shortName || '').toUpperCase() === managedShort;
                return (
                  <div key={row.teamId} className={`league-form-row ${me ? 'is-managed' : ''}`}>
                    <div className="league-form-left">
                      <span>{idx + 1}</span>
                      <div className="league-team-logo-wrap small">
                        <img src={logoPath(team, row.shortName)} alt={row.shortName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <span>{teamInitial(row.shortName)}</span>
                      </div>
                      <strong>{row.team}</strong>
                    </div>
                    <div className="league-form-chips">
                      {chips.map((chip, i) => <i key={`${row.teamId}-${i}`} className={chip === 'W' ? 'is-win' : 'is-loss'}>{chip}</i>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

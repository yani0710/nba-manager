import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonCard } from '../../components/ui';
import './teams.css';

const EAST = new Set(['BOS', 'BKN', 'NYK', 'PHI', 'TOR', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'ATL', 'CHA', 'MIA', 'ORL', 'WAS']);

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function teamConference(team) {
  const conf = String(team?.conference || '').toLowerCase();
  if (conf.includes('east')) return 'Eastern Conference';
  if (conf.includes('west')) return 'Western Conference';
  return EAST.has(String(team?.shortName || '').toUpperCase()) ? 'Eastern Conference' : 'Western Conference';
}

function teamTone(team) {
  const s = String(team?.shortName || '').toUpperCase();
  if (['LAL', 'SAC', 'PHX'].includes(s)) return 'is-purple';
  if (['MIA', 'CHI', 'ATL', 'POR', 'HOU'].includes(s)) return 'is-red';
  if (['BOS', 'MIL', 'DAL', 'MIN'].includes(s)) return 'is-green';
  return 'is-blue';
}

function logoPath(team) {
  const short = (team?.shortName || '').toLowerCase();
  const aliases = { bkn: 'brk' };
  return team?.logoPath || `/images/teams/${aliases[short] || short}.png`;
}

function winPct(team) {
  const wins = num(team?.wins, 0);
  const losses = num(team?.losses, 0);
  const games = wins + losses;
  if (!games) return num(team?.winPct, 0);
  return Math.round((wins / games) * 100);
}

function parseLast5(last5) {
  const s = String(last5 || '').toUpperCase().replace(/[^WL]/g, '');
  return s ? s.slice(-5).split('') : [];
}

function formatStreak(streakValue, formValue = 50) {
  const n = Number(streakValue);
  if (Number.isFinite(n) && n !== 0) return `${n > 0 ? 'W' : 'L'}${Math.abs(n)}`;
  if (Number.isFinite(n) && n === 0) return 'Even';
  return `${num(formValue, 50) >= 55 ? 'W' : 'L'}1`;
}

export function Teams() {
  const { teams, standings, fetchTeams, fetchStandings, loading, currentSave } = useGameStore();
  const [conference, setConference] = useState('All Conference');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [openTeam, setOpenTeam] = useState(null);

  useEffect(() => {
    fetchTeams();
    fetchStandings();
  }, [fetchTeams, fetchStandings, currentSave?.id]);

  const standingsByShort = useMemo(() => {
    const map = new Map();
    [...(standings?.east || []), ...(standings?.west || [])].forEach((row) => {
      const key = String(row?.shortName || '').toUpperCase();
      if (key) map.set(key, row);
    });
    return map;
  }, [standings?.east, standings?.west]);

  const decorated = useMemo(() => {
    return (teams || []).map((t) => {
      const conf = teamConference(t);
      const standing = standingsByShort.get(String(t.shortName || '').toUpperCase());
      return {
        ...t,
        conferenceLabel: conf,
        wins: num(standing?.wins, num(t.wins, 0)),
        losses: num(standing?.losses, num(t.losses, 0)),
        gamesBehind: standing?.gb ?? t.gamesBehind ?? '-',
        avgPoints: Number(num(t.avgPoints, 106 + ((num(t.form, 50) - 50) * 0.2))).toFixed(1),
        streak: String(standing?.streak || formatStreak(t.streak, t.form)).toUpperCase(),
      };
    });
  }, [teams, standingsByShort]);

  const filtered = useMemo(() => {
    if (conference === 'All Conference') return decorated;
    return decorated.filter((t) => t.conferenceLabel === conference);
  }, [conference, decorated]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedTeam(null);
      return;
    }
    if (selectedTeam && filtered.some((t) => t.id === selectedTeam.id)) return;
    const managedCode = currentSave?.data?.career?.teamShortName;
    setSelectedTeam(filtered.find((t) => t.shortName === managedCode) || filtered[0]);
  }, [filtered, selectedTeam, currentSave?.data?.career?.teamShortName]);

  return (
    <div className="tmdb-page">
      <PageHeader title="NBA Teams" subtitle="Complete overview of all NBA franchises and their performance" />

      <div className="tmdb-conf-tabs">
        {['All Conference', 'Western Conference', 'Eastern Conference'].map((c) => (
          <button key={c} type="button" className={conference === c ? 'is-active' : ''} onClick={() => setConference(c)}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div className="ui-card-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="ui-col-4"><SkeletonCard /></div>)}</div>
      ) : null}

      {!loading && filtered.length === 0 ? <EmptyState title="No teams loaded" description="Load teams data to browse league clubs." /> : null}

      {!loading && filtered.length > 0 ? (
        <section className="tmdb-layout">
          <div className="tmdb-grid">
            {filtered.map((team) => (
              <button key={team.id} type="button" className={`tmdb-card ${teamTone(team)} ${selectedTeam?.id === team.id ? 'is-selected' : ''}`} onClick={() => setSelectedTeam(team)} onDoubleClick={() => setOpenTeam(team)}>
                <div className="tmdb-card-head">
                  <div className="tmdb-logo-box">
                    <img src={logoPath(team)} alt={team.shortName || team.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <span>{team.shortName?.slice(0, 1) || 'T'}</span>
                  </div>
                  <div>
                    <strong>{team.name}</strong>
                    <small>{team.conferenceLabel}</small>
                  </div>
                </div>
                <div className="tmdb-metrics">
                  <div><span>Record</span><b>{team.wins}-{team.losses}</b></div>
                  <div><span>WIN%</span><b>{winPct(team)}%</b></div>
                  <div><span>GB</span><b>{num(team.gamesBehind, 0) || '-'}</b></div>
                </div>
                <div className="tmdb-last5">
                  {parseLast5(team.last5).length
                    ? parseLast5(team.last5).map((r, idx) => <i key={`${team.id}-${idx}`} className={r === 'W' ? 'is-win' : 'is-loss'}>{r}</i>)
                    : <small style={{ color: '#8ea9d2' }}>No recent games</small>}
                </div>
                <div className="tmdb-foot"><span>{team.streak}</span><b>Avg Points {team.avgPoints}</b></div>
              </button>
            ))}
          </div>

          <aside className="tmdb-side">
            {!selectedTeam ? null : (
              <>
                <article className={`tmdb-side-card ${teamTone(selectedTeam)}`}>
                  <div className="tmdb-card-head">
                    <div className="tmdb-logo-box">
                      <img src={logoPath(selectedTeam)} alt={selectedTeam.shortName || selectedTeam.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <span>{selectedTeam.shortName?.slice(0, 1) || 'T'}</span>
                    </div>
                    <div>
                      <strong>{selectedTeam.name}</strong>
                      <small>{selectedTeam.conferenceLabel}</small>
                    </div>
                  </div>
                  <div className="tmdb-lines">
                    <div><span>Head Coach</span><b>{selectedTeam.coachName || 'Staff Coach'}</b></div>
                    <div><span>Arena</span><b>{selectedTeam.arenaName || `${selectedTeam.city || selectedTeam.name} Arena`}</b></div>
                    <div><span>Record</span><b>{selectedTeam.wins}-{selectedTeam.losses}</b></div>
                    <div><span>Win Percentage</span><b>{winPct(selectedTeam)}%</b></div>
                    <div><span>Games Behind</span><b>{num(selectedTeam.gamesBehind, 0) || '-'}</b></div>
                  </div>
                  <button type="button" className="tmdb-main-btn" onClick={() => setOpenTeam(selectedTeam)}>View Full Stats</button>
                </article>

                <article className="tmdb-side-card">
                  <h4>Quick Stats</h4>
                  <div className="tmdb-lines">
                    <div><span>Offensive Rating</span><b>{num(selectedTeam.offensiveRating, 108).toFixed(1)}</b></div>
                    <div><span>Defensive Rating</span><b>{num(selectedTeam.defensiveRating, 107).toFixed(1)}</b></div>
                    <div><span>Pace</span><b>{num(selectedTeam.pace, 101).toFixed(1)}</b></div>
                  </div>
                </article>
              </>
            )}
          </aside>
        </section>
      ) : null}

      {openTeam ? (
        <div className="tmdb-modal-backdrop" onClick={() => setOpenTeam(null)}>
          <article className={`tmdb-modal ${teamTone(openTeam)}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tmdb-close" onClick={() => setOpenTeam(null)}>×</button>
            <header className="tmdb-modal-head">
              <div className="tmdb-logo-box big">
                <img src={logoPath(openTeam)} alt={openTeam.shortName || openTeam.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span>{openTeam.shortName?.slice(0, 1) || 'T'}</span>
              </div>
              <div>
                <h2>{openTeam.name}</h2>
                <p>{openTeam.conferenceLabel} • {openTeam.arenaName || `${openTeam.city || openTeam.name} Arena`}</p>
                <div className="tmdb-kpis">
                  <div><span>Record</span><b>{openTeam.wins}-{openTeam.losses}</b></div>
                  <div><span>WIN %</span><b>{winPct(openTeam)}%</b></div>
                  <div><span>Streak</span><b>{openTeam.streak}</b></div>
                  <div><span>GB</span><b>{num(openTeam.gamesBehind, 0) || '-'}</b></div>
                </div>
              </div>
            </header>

            <div className="tmdb-modal-grid">
              <section className="tmdb-panel">
                <h3>2025-26 Season Performance</h3>
                <div className="tmdb-metrics-grid">
                  <div><span>Avg Points</span><b>{openTeam.avgPoints}</b></div>
                  <div><span>Avg Assists</span><b>{num(openTeam.avgAssists, 24).toFixed(1)}</b></div>
                  <div><span>Avg Rebounds</span><b>{num(openTeam.avgRebounds, 44).toFixed(1)}</b></div>
                </div>
                <div className="tmdb-bars">
                  <div><span>Offensive Rating</span><b>{num(openTeam.offensiveRating, 108).toFixed(1)}</b><i><i style={{ width: `${clamp(num(openTeam.offensiveRating, 108), 80, 130) - 70}%` }} /></i></div>
                  <div><span>Defensive Rating</span><b>{num(openTeam.defensiveRating, 107).toFixed(1)}</b><i><i style={{ width: `${clamp(num(openTeam.defensiveRating, 107), 80, 130) - 70}%` }} /></i></div>
                  <div><span>Pace</span><b>{num(openTeam.pace, 101).toFixed(1)}</b><i><i style={{ width: `${clamp(num(openTeam.pace, 101), 85, 120) - 75}%` }} /></i></div>
                </div>
              </section>

              <section className="tmdb-panel">
                <h3>Team Details</h3>
                <div className="tmdb-note-list">
                  <article><b>Head Coach</b><small>{openTeam.coachName || 'Mike Malone'}</small></article>
                  <article><b>Home Arena</b><small>{openTeam.arenaName || `${openTeam.city || openTeam.name} Arena`}</small></article>
                  <article><b>Conference Rank</b><small>#{Math.max(1, Math.round((100 - winPct(openTeam)) / 8))} in {openTeam.conferenceLabel.includes('West') ? 'Western' : 'Eastern'}</small></article>
                </div>
              </section>

              <section className="tmdb-panel">
                <h3>Recent Form</h3>
                <div className="tmdb-last5 modal">{parseLast5(openTeam.last5).map((r, idx) => <i key={`m-${idx}`} className={r === 'W' ? 'is-win' : 'is-loss'}>{r}</i>)}</div>
                <div className="tmdb-lines" style={{ marginTop: 10 }}>
                  <div><span>Current Streak</span><b>{openTeam.streak}</b></div>
                  <div><span>Form Rating</span><b>{parseLast5(openTeam.last5).filter((x) => x === 'W').length}/5</b></div>
                </div>
              </section>

              <section className="tmdb-panel">
                <h3>Analysis</h3>
                <div className="tmdb-note-list">
                  <article><b>Strengths</b><small>Strong two-way structure and consistent shot quality.</small></article>
                  <article><b>Key Focus</b><small>Maintain consistency and prepare for playoff run.</small></article>
                </div>
              </section>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, SkeletonTable } from '../../components/ui';
import './squad.css';

const FILTERS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];
const SALARY_CAP = 145_000_000;

function initials(value) {
  return String(value || '')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'TM';
}

function toMoneyMillions(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.0M';
  return `$${(n / 1_000_000).toFixed(1)}M`;
}

function getPlayerSalary(player) {
  const direct = Number(player?.salary);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const contract = player?.contracts;
  const currentYear = Number(contract?.currentYearSalary);
  if (Number.isFinite(currentYear) && currentYear > 0) return currentYear;

  const base = Number(contract?.salary);
  if (Number.isFinite(base) && base > 0) return base;

  const aav = Number(contract?.averageAnnualValue);
  if (Number.isFinite(aav) && aav > 0) return aav;

  const contractYears = Array.isArray(contract?.contractYears) ? contract.contractYears : [];
  const yearSalary = contractYears
    .map((row) => Number(row?.salary))
    .find((n) => Number.isFinite(n) && n > 0);
  if (Number.isFinite(yearSalary) && yearSalary > 0) return yearSalary;

  return 0;
}

function getPosTokens(position) {
  return String(position || '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
}

function moodEmoji(morale) {
  const m = Number(morale ?? 60);
  if (m >= 80) return '😁';
  if (m >= 65) return '🙂';
  if (m >= 50) return '😐';
  return '🙁';
}

function statusForPlayer(player, injuries) {
  const name = String(player?.name || '').toLowerCase().trim();
  const injury = (injuries || []).find((i) => String(i.playerName || '').toLowerCase().trim() === name);
  if (injury) return `Injured (${injury.expectedReturnWeeks || 1}w)`;
  return 'Healthy';
}

function statBarWidth(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || max <= 0) return 0;
  return Math.max(4, Math.min(100, (n / max) * 100));
}

export function Squad() {
  const {
    currentSave,
    dashboard,
    squadPlayers,
    fetchSquad,
    fetchDashboard,
    loading,
  } = useGameStore();
  const [activeFilter, setActiveFilter] = useState('ALL');

  const teamShortName = currentSave?.data?.career?.teamShortName ?? currentSave?.team?.shortName ?? null;
  const teamName = currentSave?.team?.name || teamShortName || 'Team';
  const teamCity = currentSave?.team?.city || 'Los Angeles';
  const teamDivision = currentSave?.team?.division || 'Division';
  const managedTeamId = currentSave?.managedTeamId || currentSave?.teamId || null;
  const teamState = managedTeamId ? currentSave?.data?.teamState?.[String(managedTeamId)] : null;
  const injuries = currentSave?.data?.injuries || [];

  useEffect(() => {
    if (!teamShortName) return;
    fetchSquad();
    fetchDashboard();
  }, [fetchSquad, fetchDashboard, currentSave?.id, teamShortName]);

  const players = useMemo(() => {
    const all = Array.isArray(squadPlayers) ? squadPlayers : [];
    if (activeFilter === 'ALL') return all;
    return all.filter((player) => {
      const tokens = getPosTokens(player.position);
      return tokens.includes(activeFilter);
    });
  }, [squadPlayers, activeFilter]);

  const maxPts = Math.max(1, ...players.map((p) => Number(p.ptsCareer ?? 0)));
  const maxReb = Math.max(1, ...players.map((p) => Number(p.trbCareer ?? 0)));
  const maxAst = Math.max(1, ...players.map((p) => Number(p.astCareer ?? 0)));
  const payroll = (squadPlayers || []).reduce((sum, p) => sum + getPlayerSalary(p), 0);
  const capSpace = SALARY_CAP - payroll;
  const streakValue = Number(teamState?.streak || 0);
  const streakLabel = streakValue > 0 ? `W${streakValue}` : streakValue < 0 ? `L${Math.abs(streakValue)}` : '-';
  const wins = dashboard?.overview?.wins ?? 0;
  const losses = dashboard?.overview?.losses ?? 0;

  if (!teamShortName) {
    return (
      <div>
        <EmptyState title="No managed team" description="Start or load a career with a team to view your roster." />
      </div>
    );
  }

  if (loading && (!squadPlayers || squadPlayers.length === 0)) {
    return <SkeletonTable rows={10} cols={8} />;
  }

  return (
    <div className="squad-page-v2">
      <section className="sq-top-strip">
        <div className="sq-team-head">
          <div className="sq-team-badge">{teamShortName}</div>
          <div>
            <h1>{String(teamName).toUpperCase()}</h1>
            <p>{teamCity}, California • {teamDivision}</p>
          </div>
        </div>
        <div className="sq-top-stats">
          <div>
            <span>Record</span>
            <strong>{wins}-{losses}</strong>
          </div>
          <div>
            <span>Streak</span>
            <strong className="streak">{streakLabel}</strong>
          </div>
          <div>
            <span>Cap</span>
            <strong>${Math.round(SALARY_CAP / 1_000_000)}M</strong>
          </div>
          <div>
            <span>Payroll</span>
            <strong className="payroll">{toMoneyMillions(payroll)}</strong>
            <small>{((payroll / SALARY_CAP) * 100).toFixed(1)}% of cap</small>
          </div>
        </div>
      </section>

      <section className="sq-filter-tabs">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            className={`sq-tab ${activeFilter === key ? 'is-active' : ''}`}
            onClick={() => setActiveFilter(key)}
          >
            {key}
          </button>
        ))}
      </section>

      <section className="sq-card">
        <h3>SQUAD ROSTER</h3>
        <p>Showing {players.length} of {(squadPlayers || []).length} players</p>

        {(squadPlayers || []).length === 0 ? (
          <EmptyState title="No squad players" description="Roster data is empty for this managed team." />
        ) : (
          <div className="sq-table-wrap">
            <table className="sq-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>PLAYER</th>
                  <th>POS</th>
                  <th>AGE</th>
                  <th>OVR</th>
                  <th>PTS</th>
                  <th>REB</th>
                  <th>AST</th>
                  <th>FG%</th>
                  <th>STATUS</th>
                  <th>MOOD</th>
                  <th>CONTRACT</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const points = Number(player.ptsCareer ?? 0);
                  const rebounds = Number(player.trbCareer ?? 0);
                  const assists = Number(player.astCareer ?? 0);
                  const fgPct = Number(player.fgPct ?? 0) * 100;
                  const overall = Number(player.overallCurrent ?? player.overall ?? 60);
                  const potential = Number(player.potential ?? overall);
                  const morale = Number(player.morale ?? 60);
                  return (
                    <tr key={player.id}>
                      <td>{player.jerseyNumber ?? player.number ?? '-'}</td>
                      <td>
                        <div className="sq-player-cell">
                          <span className="sq-avatar">{initials(player.name)}</span>
                          <div>
                            <strong>{player.name}</strong>
                            <small>{player.nationality || 'USA'}</small>
                          </div>
                        </div>
                      </td>
                      <td>{player.position || '-'}</td>
                      <td>{player.age ?? '--'}</td>
                      <td>
                        <div className="sq-ovr">
                          <span>{overall}</span>
                          <small>↗ {potential}</small>
                        </div>
                      </td>
                      <td>
                        <div className="sq-stat-cell">
                          <span>{points.toFixed(1)}</span>
                          <i style={{ width: `${statBarWidth(points, maxPts)}%` }} />
                        </div>
                      </td>
                      <td>
                        <div className="sq-stat-cell">
                          <span>{rebounds.toFixed(1)}</span>
                          <i style={{ width: `${statBarWidth(rebounds, maxReb)}%` }} />
                        </div>
                      </td>
                      <td>
                        <div className="sq-stat-cell">
                          <span>{assists.toFixed(1)}</span>
                          <i style={{ width: `${statBarWidth(assists, maxAst)}%` }} />
                        </div>
                      </td>
                      <td>{Number.isFinite(fgPct) ? `${fgPct.toFixed(1)}%` : '--'}</td>
                      <td>{statusForPlayer(player, injuries)}</td>
                      <td>{moodEmoji(morale)}</td>
                      <td>{toMoneyMillions(getPlayerSalary(player))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sq-bottom-stats">
        <article>
          <span>Average Age</span>
          <strong>{(((squadPlayers || []).reduce((sum, p) => sum + (Number(p.age) || 0), 0) / Math.max(1, (squadPlayers || []).length)) || 0).toFixed(1)}</strong>
        </article>
        <article>
          <span>Team Average</span>
          <strong>{(((squadPlayers || []).reduce((sum, p) => sum + (Number(p.overallCurrent ?? p.overall) || 0), 0) / Math.max(1, (squadPlayers || []).length)) || 0).toFixed(1)}</strong>
        </article>
        <article>
          <span>Healthy Players</span>
          <strong>{(squadPlayers || []).filter((p) => statusForPlayer(p, injuries) === 'Healthy').length}/{(squadPlayers || []).length}</strong>
        </article>
        <article>
          <span>Cap Space</span>
          <strong>{toMoneyMillions(capSpace)}</strong>
        </article>
      </section>
    </div>
  );
}

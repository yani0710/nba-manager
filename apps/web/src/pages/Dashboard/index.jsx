import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState } from '../../components/ui';
import { formatFixtureDate } from '../../domain/fixtures';
import '../Dashboard.css';

function toMoneyMillions(value) {
  if (!Number.isFinite(value)) return '$0M';
  return `$${Math.round(value / 1_000_000)}M`;
}

function toPercent(value) {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

function toOrdinal(value) {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = abs % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function DashboardLineChart({ series }) {
  const [hovered, setHovered] = useState(null);
  const chartWidth = 680;
  const chartHeight = 250;
  const left = 52;
  const right = 20;
  const top = 14;
  const bottom = 40;
  const width = chartWidth - left - right;
  const height = chartHeight - top - bottom;
  const safeSeries = Array.isArray(series) ? series : [];
  const max = Math.max(140, ...safeSeries.map((item) => item.points ?? 0));
  const min = 0;

  const toX = (idx) => {
    if (safeSeries.length <= 1) return left + width / 2;
    return left + ((width * idx) / (safeSeries.length - 1));
  };
  const toY = (value) => top + ((max - value) / (max - min || 1)) * height;

  const path = safeSeries
    .map((item, idx) => `${idx === 0 ? 'M' : 'L'}${toX(idx)},${toY(item.points ?? 0)}`)
    .join(' ');

  const yTicks = [0, 35, 70, 105, 140];

  return (
    <div className="dash-chart-wrap">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="dash-chart-svg" role="img" aria-label="Recent performance">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line className="dash-grid-line" x1={left} y1={toY(tick)} x2={chartWidth - right} y2={toY(tick)} />
            <text className="dash-axis-text" x={left - 8} y={toY(tick) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        {safeSeries.map((item, idx) => (
          <g key={item.label || idx}>
            <line className="dash-grid-line dash-grid-vertical" x1={toX(idx)} y1={top} x2={toX(idx)} y2={top + height} />
            <text className="dash-axis-text" x={toX(idx)} y={chartHeight - 14} textAnchor="middle">{item.label || `G${idx + 1}`}</text>
          </g>
        ))}
        <path d={path} className="dash-line" />
        {safeSeries.map((item, idx) => (
          <g key={`${item.label || idx}-pt`}>
            <circle className="dash-line-point" cx={toX(idx)} cy={toY(item.points ?? 0)} r="3.5" />
            <circle
              className="dash-hit-point"
              cx={toX(idx)}
              cy={toY(item.points ?? 0)}
              r="12"
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered((prev) => (prev === idx ? null : prev))}
            />
          </g>
        ))}
        {hovered != null && safeSeries[hovered] ? (
          <>
            <line
              className="dash-hover-line"
              x1={toX(hovered)}
              y1={top}
              x2={toX(hovered)}
              y2={top + height}
            />
            <circle className="dash-hover-point" cx={toX(hovered)} cy={toY(safeSeries[hovered].points ?? 0)} r="4.5" />
            <g transform={`translate(${Math.min(chartWidth - 150, toX(hovered) + 10)}, ${Math.max(top + 4, toY(safeSeries[hovered].points ?? 0) - 14)})`}>
              <rect className="dash-tooltip-bg" width="110" height="54" rx="0" />
              <text className="dash-tooltip-title" x="10" y="20">{safeSeries[hovered].label || `G${hovered + 1}`}</text>
              <text className="dash-tooltip-value" x="10" y="40">points : {safeSeries[hovered].points ?? 0}</text>
            </g>
          </>
        ) : null}
      </svg>
    </div>
  );
}

function DashboardBarChart({ leaders }) {
  const [hovered, setHovered] = useState(null);
  const chartWidth = 680;
  const chartHeight = 250;
  const left = 48;
  const right = 16;
  const top = 14;
  const bottom = 48;
  const width = chartWidth - left - right;
  const height = chartHeight - top - bottom;
  const safe = Array.isArray(leaders) ? leaders : [];
  const max = Math.max(10, ...safe.map((item) => item.value ?? 0));
  const step = Math.max(2, Math.ceil(max / 4));
  const ticks = [0, step, step * 2, step * 3, step * 4];
  const slot = safe.length > 0 ? width / safe.length : width;
  const barWidth = Math.max(32, slot - 12);

  return (
    <div className="dash-chart-wrap">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="dash-chart-svg" role="img" aria-label="Top scorers">
        {ticks.map((tick) => {
          const y = top + ((max - tick) / (max || 1)) * height;
          return (
            <g key={tick}>
              <line className="dash-grid-line" x1={left} y1={y} x2={chartWidth - right} y2={y} />
              <text className="dash-axis-text" x={left - 8} y={y + 4} textAnchor="end">{tick}</text>
            </g>
          );
        })}
        {safe.map((entry, idx) => {
          const barHeight = ((entry.value ?? 0) / (max || 1)) * height;
          const x = left + idx * slot + (slot - barWidth) / 2;
          const y = top + (height - barHeight);
          return (
            <g key={entry.name}>
              <line className="dash-grid-line dash-grid-vertical" x1={x + barWidth / 2} y1={top} x2={x + barWidth / 2} y2={top + height} />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                className={`dash-bar ${hovered === idx ? 'is-hovered' : ''}`}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered((prev) => (prev === idx ? null : prev))}
              />
              <text className="dash-axis-text" x={x + barWidth / 2} y={chartHeight - 14} textAnchor="middle">
                {(entry.name || '').split(' ').slice(0, 2).join(' ')}
              </text>
            </g>
          );
        })}
        {hovered != null && safe[hovered] ? (() => {
          const entry = safe[hovered];
          const barHeight = ((entry.value ?? 0) / (max || 1)) * height;
          const x = left + hovered * slot + (slot - barWidth) / 2;
          const y = top + (height - barHeight);
          const tipX = Math.min(chartWidth - 170, Math.max(left + 4, x + barWidth / 2 - 70));
          const tipY = Math.max(top + 4, y + 16);
          return (
            <g transform={`translate(${tipX}, ${tipY})`}>
              <rect className="dash-tooltip-bg" width="150" height="66" rx="0" />
              <text className="dash-tooltip-title" x="10" y="23">{entry.name || 'Player'}</text>
              <text className="dash-tooltip-label" x="10" y="44">stats points : {(entry.totalPoints ?? entry.value ?? 0)}</text>
            </g>
          );
        })() : null}
      </svg>
    </div>
  );
}

export function Dashboard() {
  const {
    currentSave,
    dashboard,
    advanceSave,
    fetchDashboard,
  } = useGameStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleAdvance = async () => {
    if (currentSave) await advanceSave(currentSave.id);
  };

  const overview = dashboard?.overview || {};
  const nextMatch = dashboard?.nextMatch || null;
  const performanceSeries = dashboard?.recentPerformance || [];
  const topScorers = dashboard?.topScorers || dashboard?.leaders || [];
  const upcomingFixtures = dashboard?.upcomingFixtures || [];
  const recentResults = dashboard?.recentResults || [];
  const hasTeam = Boolean(currentSave?.teamId || currentSave?.managedTeamId);

  const nextMatchLabel = nextMatch
    ? (nextMatch.homeTeamId === (currentSave?.teamId || currentSave?.managedTeamId)
      ? `vs ${nextMatch.awayTeam.shortName}`
      : `at ${nextMatch.homeTeam.shortName}`)
    : 'No match';

  return (
    <div className="dashboard-page dashboard-v2">
      <div className="dash-header">
        <div>
          <h1>Team Dashboard</h1>
          <p>Overview of your team&apos;s performance and upcoming fixtures</p>
        </div>
        <button className="ui-btn ui-btn-primary" onClick={handleAdvance}>Advance Day</button>
      </div>

      <div className="dash-gw-pill">
        GW {overview.currentWeek ?? currentSave?.data?.week ?? '-'} | Simulated {overview.simulatedGamesInWeek ?? 0}/{overview.totalGamesInWeek ?? 0}
      </div>

      {!hasTeam ? (
        <section className="ui-card">
          <EmptyState title="No managed team selected" description="Start or load a save with a team to view the full dashboard widgets." />
        </section>
      ) : (
        <>
          <section className="dash-top-stats">
            <article className="dash-stat-card">
              <div className="dash-stat-label">League Position</div>
              <div className="dash-stat-value">{toOrdinal(overview.leaguePosition)}</div>
              <div className="dash-stat-help">{overview.conference || 'Conference'}</div>
            </article>

            <article className="dash-stat-card">
              <div className="dash-stat-label">Win Rate</div>
              <div className="dash-stat-value">{toPercent(overview.winRate)}</div>
              <div className="dash-stat-help">{overview.wins ?? 0}-{overview.losses ?? 0} record</div>
            </article>

            <article className="dash-stat-card">
              <div className="dash-stat-label">Next Match</div>
              <div className="dash-stat-value dash-stat-next">{nextMatchLabel}</div>
              <div className="dash-stat-help">{nextMatch ? formatFixtureDate(nextMatch.gameDate) : 'No upcoming fixture'}</div>
            </article>

            <article className="dash-stat-card">
              <div className="dash-stat-label">Team Value</div>
              <div className="dash-stat-value">{toMoneyMillions(overview.teamValue || 0)}</div>
              <div className="dash-stat-help">Total squad value</div>
            </article>
          </section>

          <section className="dash-panels-two">
            <article className="dash-panel">
              <h3>Recent Performance</h3>
              <DashboardLineChart series={performanceSeries} />
            </article>

            <article className="dash-panel">
              <h3>Top Scorers</h3>
              <DashboardBarChart leaders={topScorers} />
            </article>
          </section>

          <section className="dash-panels-two">
            <article className="dash-panel">
              <h3>Upcoming Fixtures</h3>
              <div className="dash-list">
                {upcomingFixtures.length === 0 && (
                  <div className="dash-list-item">No upcoming fixtures.</div>
                )}
                {upcomingFixtures.map((fixture) => (
                  <div key={fixture.id} className="dash-list-item">
                    <div>
                      <div className="dash-list-main">{fixture.awayTeam.shortName} vs {fixture.homeTeam.shortName}</div>
                      <div className="dash-list-sub">{formatFixtureDate(fixture.gameDate)}</div>
                    </div>
                    <button className="dash-pill-btn" type="button" onClick={() => { window.location.hash = `prepare?gameId=${fixture.id}`; }}>
                      Prepare
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <article className="dash-panel">
              <h3>Recent Results</h3>
              <div className="dash-list">
                {recentResults.length === 0 && (
                  <div className="dash-list-item">No completed matches.</div>
                )}
                {recentResults.map((game) => {
                  const managedTeamId = currentSave?.managedTeamId || currentSave?.teamId;
                  const managedIsHome = game.homeTeamId === managedTeamId;
                  const managedScore = managedIsHome ? game.homeScore : game.awayScore;
                  const oppScore = managedIsHome ? game.awayScore : game.homeScore;
                  const won = managedScore > oppScore;
                  return (
                    <div key={game.id} className="dash-list-item">
                      <div>
                        <div className="dash-list-main">
                          {game.homeTeam.shortName} {game.homeScore}
                        </div>
                        <div className="dash-list-main">
                          {game.awayTeam.shortName} {game.awayScore}
                        </div>
                      </div>
                      <div className={`dash-result-badge ${won ? 'is-win' : 'is-loss'}`}>{won ? 'W' : 'L'}</div>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}

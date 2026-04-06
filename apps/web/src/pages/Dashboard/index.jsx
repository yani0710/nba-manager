import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState } from '../../components/ui';
import { formatFixtureDate } from '../../domain/fixtures';
import '../Dashboard.css';

const RADAR_AXES = ['Offense', 'Defense', 'Rebound', 'Passing', 'Shooting', 'Speed'];
const TRANSFER_ALERT_KEYWORDS = [
  'trade',
  'offer',
  'proposal',
  'agent',
  'listed',
  'transfer',
  'counter',
  'negotiation',
];

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

function formatDateLong(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateShort(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatClock(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function initials(name) {
  const source = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0])
    .join('');
  return source.toUpperCase() || '--';
}

function formatTipoff(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);
}

function isTransferAlertItem(item) {
  const blob = `${item?.subject || ''} ${item?.body || ''} ${item?.from || ''}`.toLowerCase();
  return TRANSFER_ALERT_KEYWORDS.some((keyword) => blob.includes(keyword));
}

function normalizeScore(value) {
  return Number.isFinite(value) ? value : 0;
}

function buildPerformanceSeries(performanceSeries, recentResults, managedTeamId) {
  const safeSeries = Array.isArray(performanceSeries) ? performanceSeries : [];
  const safeResults = Array.isArray(recentResults) ? [...recentResults].reverse() : [];
  const opponentByScore = new Map();

  safeResults.forEach((game) => {
    const managedIsHome = game.homeTeamId === managedTeamId;
    const managedScore = normalizeScore(managedIsHome ? game.homeScore : game.awayScore);
    const oppScore = normalizeScore(managedIsHome ? game.awayScore : game.homeScore);
    opponentByScore.set(managedScore, oppScore);
  });

  const fallbackOpp = safeResults.length > 0
    ? Math.round(
      safeResults.reduce((sum, game) => {
        const managedIsHome = game.homeTeamId === managedTeamId;
        return sum + normalizeScore(managedIsHome ? game.awayScore : game.homeScore);
      }, 0) / safeResults.length,
    )
    : 108;

  return safeSeries.map((item, idx) => {
    const teamPoints = normalizeScore(item.points);
    const knownOpp = opponentByScore.get(teamPoints);
    const rollingShift = (idx % 2 === 0 ? -2 : 2) + (idx % 3 === 0 ? -1 : 1);
    return {
      label: item.label || `G${idx + 1}`,
      teamPoints,
      oppPoints: Number.isFinite(knownOpp) ? knownOpp : Math.max(80, fallbackOpp + rollingShift),
    };
  });
}

function PerformanceTrendChart({ data }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const chartWidth = 760;
  const chartHeight = 280;
  const left = 44;
  const right = 16;
  const top = 18;
  const bottom = 34;
  const width = chartWidth - left - right;
  const height = chartHeight - top - bottom;
  const safe = Array.isArray(data) ? data : [];
  const allValues = safe.flatMap((item) => [item.teamPoints ?? 0, item.oppPoints ?? 0]);
  const minVal = Math.min(90, ...allValues);
  const maxVal = Math.max(130, ...allValues);
  const range = Math.max(1, maxVal - minVal);

  const toX = (idx) => (safe.length <= 1 ? left + width / 2 : left + ((width * idx) / (safe.length - 1)));
  const toY = (value) => top + ((maxVal - value) / range) * height;

  const teamPath = safe
    .map((item, idx) => `${idx === 0 ? 'M' : 'L'}${toX(idx)},${toY(item.teamPoints ?? 0)}`)
    .join(' ');
  const oppPath = safe
    .map((item, idx) => `${idx === 0 ? 'M' : 'L'}${toX(idx)},${toY(item.oppPoints ?? 0)}`)
    .join(' ');
  const yTicks = [minVal, minVal + range * 0.33, minVal + range * 0.66, maxVal].map((value) => Math.round(value));
  const hovered = hoveredIndex != null ? safe[hoveredIndex] : null;
  const hoverX = hoveredIndex != null ? toX(hoveredIndex) : null;
  const hoverY = hovered ? toY(hovered.teamPoints ?? 0) : null;
  const tipWidth = 210;
  const tipHeight = 96;
  const tipX = hoveredIndex != null
    ? Math.max(8, Math.min(chartWidth - tipWidth - 8, hoverX + 12))
    : 0;
  const tipY = hoveredIndex != null
    ? Math.max(8, Math.min(chartHeight - tipHeight - 8, hoverY - 40))
    : 0;

  return (
    <div className="dash-chart-wrap" onMouseLeave={() => setHoveredIndex(null)}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="dash-chart-svg" role="img" aria-label="Performance trend">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line className="dash-grid-line" x1={left} y1={toY(tick)} x2={chartWidth - right} y2={toY(tick)} />
            <text className="dash-axis-text" x={left - 6} y={toY(tick) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        {safe.map((item, idx) => (
          <g key={item.label || idx}>
            <line className="dash-grid-line dash-grid-vertical" x1={toX(idx)} y1={top} x2={toX(idx)} y2={top + height} />
            <text className="dash-axis-text" x={toX(idx)} y={chartHeight - 10} textAnchor="middle">{item.label || `G${idx + 1}`}</text>
          </g>
        ))}
        {safe.map((item, idx) => {
          const startX = idx === 0 ? left : (toX(idx - 1) + toX(idx)) / 2;
          const endX = idx === safe.length - 1 ? chartWidth - right : (toX(idx) + toX(idx + 1)) / 2;
          return (
            <rect
              key={`hover-zone-${item.label || idx}`}
              x={startX}
              y={top}
              width={Math.max(20, endX - startX)}
              height={height}
              className="dash-hover-zone"
              onMouseEnter={() => setHoveredIndex(idx)}
            />
          );
        })}
        <path d={oppPath} className="dash-line-opponent" />
        <path d={teamPath} className="dash-line-team" />
        {safe.map((item, idx) => (
          <g key={`team-${idx}`}>
            <circle cx={toX(idx)} cy={toY(item.teamPoints ?? 0)} r={hoveredIndex === idx ? '6.5' : '4.5'} className="dash-line-point-team" />
            <circle cx={toX(idx)} cy={toY(item.oppPoints ?? 0)} r={hoveredIndex === idx ? '6.5' : '4.5'} className="dash-line-point-opponent" />
          </g>
        ))}
        {hovered ? (
          <>
            <line className="dash-hover-line" x1={hoverX} y1={top} x2={hoverX} y2={top + height} />
            <g transform={`translate(${tipX}, ${tipY})`}>
              <rect className="dash-tooltip-bg" width={tipWidth} height={tipHeight} rx="12" />
              <text className="dash-tooltip-title" x="14" y="28">{hovered.label}</text>
              <text className="dash-tooltip-team" x="14" y="56">LAL: {hovered.teamPoints}</text>
              <text className="dash-tooltip-opp" x="14" y="82">Opp: {hovered.oppPoints}</text>
            </g>
          </>
        ) : null}
      </svg>
    </div>
  );
}

function TeamRadarChart({ values }) {
  const width = 360;
  const height = 280;
  const cx = width / 2;
  const cy = height / 2 + 8;
  const radius = 108;
  const safeValues = Array.isArray(values) && values.length === RADAR_AXES.length ? values : [74, 72, 76, 70, 75, 73];

  const pointFor = (idx, factor = 1) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * idx) / RADAR_AXES.length);
    return {
      x: cx + Math.cos(angle) * radius * factor,
      y: cy + Math.sin(angle) * radius * factor,
    };
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const polygonPoints = safeValues
    .map((value, idx) => {
      const factor = Math.max(0, Math.min(1, Number(value) / 100));
      const point = pointFor(idx, factor);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="dash-radar-svg" role="img" aria-label="Team ratings">
      {rings.map((ring) => {
        const points = RADAR_AXES.map((_, idx) => {
          const p = pointFor(idx, ring);
          return `${p.x},${p.y}`;
        }).join(' ');
        return <polygon key={ring} className="dash-radar-ring" points={points} />;
      })}
      {RADAR_AXES.map((axis, idx) => {
        const point = pointFor(idx);
        return (
          <g key={axis}>
            <line className="dash-radar-axis" x1={cx} y1={cy} x2={point.x} y2={point.y} />
            <text className="dash-radar-label" x={point.x} y={point.y} textAnchor="middle">
              {axis}
            </text>
          </g>
        );
      })}
      <polygon className="dash-radar-fill" points={polygonPoints} />
      <polygon className="dash-radar-stroke" points={polygonPoints} />
    </svg>
  );
}

function resultToken(game, managedTeamId) {
  const managedIsHome = game.homeTeamId === managedTeamId;
  const managedScore = managedIsHome ? game.homeScore : game.awayScore;
  const oppScore = managedIsHome ? game.awayScore : game.homeScore;
  if (!Number.isFinite(managedScore) || !Number.isFinite(oppScore)) return '-';
  return managedScore > oppScore ? 'W' : 'L';
}

function lastFiveTokens(results, managedTeamId) {
  const safe = Array.isArray(results) ? results.slice(0, 5) : [];
  return safe
    .map((game) => resultToken(game, managedTeamId))
    .reverse();
}

function StatCard({ label, value, hint, accent = 'neutral' }) {
  return (
    <article className="dash-stat-card">
      <div className="dash-stat-label">{label}</div>
      <div className="dash-stat-value">{value}</div>
      <div className={`dash-stat-help ${accent === 'good' ? 'is-good' : accent === 'warn' ? 'is-warn' : ''}`}>
        {hint}
      </div>
    </article>
  );
}

function ActionButton({ label, onClick }) {
  return (
    <button type="button" className="dash-action-btn" onClick={onClick}>
      {label}
    </button>
  );
}

export function Dashboard() {
  const {
    currentSave,
    dashboard,
    advanceSave,
    fetchDashboard,
  } = useGameStore();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAdvance = async () => {
    if (currentSave) await advanceSave(currentSave.id);
  };

  const overview = dashboard?.overview || {};
  const nextMatch = dashboard?.nextMatch || null;
  const performanceSeries = dashboard?.recentPerformance || [];
  const topScorers = dashboard?.topScorers || dashboard?.leaders || [];
  const upcomingFixtures = dashboard?.upcomingFixtures || [];
  const recentResults = dashboard?.recentResults || [];
  const inboxLatest = dashboard?.inbox?.latest || [];
  const unreadInboxCount = Number(dashboard?.inbox?.unread || 0);
  const hasTeam = Boolean(currentSave?.teamId || currentSave?.managedTeamId);

  const managedTeamId = currentSave?.managedTeamId || currentSave?.teamId;
  const managedTeamName = currentSave?.team?.name || 'Managed Team';
  const managedTeamShort = currentSave?.team?.shortName || '--';
  const nextOpponent = nextMatch
    ? (nextMatch.homeTeamId === managedTeamId ? nextMatch.awayTeam : nextMatch.homeTeam)
    : null;
  const teamStreak = Number(currentSave?.data?.teamState?.[String(managedTeamId)]?.streak ?? 0);
  const streakLabel = teamStreak > 0 ? `W${teamStreak}` : teamStreak < 0 ? `L${Math.abs(teamStreak)}` : 'Even';
  const trendSeries = useMemo(
    () => buildPerformanceSeries(performanceSeries, recentResults, managedTeamId),
    [performanceSeries, recentResults, managedTeamId],
  );
  const transferAlerts = useMemo(
    () => inboxLatest.filter((item) => isTransferAlertItem(item)).slice(0, 4),
    [inboxLatest],
  );
  const lastFive = useMemo(
    () => lastFiveTokens(recentResults, managedTeamId),
    [recentResults, managedTeamId],
  );

  const offenseRating = Number(currentSave?.data?.teamState?.[String(managedTeamId)]?.offenseRating ?? 78);
  const defenseAllowed = Number(currentSave?.data?.teamState?.[String(managedTeamId)]?.defenseRating ?? 110);
  const defenseQuality = Math.max(45, Math.min(95, 130 - defenseAllowed));
  const reboundRating = Math.max(50, Math.min(95, Math.round((offenseRating + defenseQuality) / 2)));
  const passingRating = Math.max(50, Math.min(95, Math.round(overview.winRate * 100 + 12)));
  const shootingRating = Math.max(50, Math.min(95, Math.round((offenseRating * 0.7) + 18)));
  const speedRating = Math.max(50, Math.min(95, Math.round((offenseRating * 0.6) + 20)));
  const radarValues = [offenseRating, defenseQuality, reboundRating, passingRating, shootingRating, speedRating];

  const teamRecordText = `${overview.wins ?? 0}-${overview.losses ?? 0}`;
  const leagueRankText = `${toOrdinal(overview.leaguePosition)} in ${overview.conference || 'Conference'}`;
  const wins = Number(overview.wins ?? 0);
  const losses = Number(overview.losses ?? 0);
  const gamesPlayed = wins + losses;
  const seasonProgressPct = Math.max(0, Math.min(100, (gamesPlayed / 82) * 100));
  const gamesRemaining = Math.max(0, 82 - gamesPlayed);

  return (
    <div className="dashboard-page dashboard-v3">
      {!hasTeam ? (
        <section className="ui-card">
          <EmptyState title="No managed team selected" description="Start or load a save with a team to view the full dashboard widgets." />
        </section>
      ) : (
        <>
          <section className="dash-hero">
            <div className="dash-hero-head">
              <div className="dash-team-avatar">{managedTeamShort}</div>
              <div className="dash-hero-main">
                <div className="dash-team-title-row">
                  <h1>{managedTeamName}</h1>
                  <span className="dash-status-pill">ACTIVE</span>
                </div>
                <div className="dash-team-meta">
                  <span>{leagueRankText}</span>
                  <span>{streakLabel} Streak</span>
                </div>
              </div>
              <div className="dash-time-card">
                <span>Current Time</span>
                <b>{formatClock(now)}</b>
                <small>{formatDateLong(now)}</small>
              </div>
            </div>

            <div className="dash-top-stats">
              <StatCard label="Record" value={teamRecordText} hint={`${toPercent(overview.winRate)} Win Rate`} accent="good" />
              <StatCard label="PPG" value={Number(offenseRating).toFixed(1)} hint={`${offenseRating >= 112 ? '+' : ''}${Math.round(offenseRating - 110)} vs avg`} accent={offenseRating >= 110 ? 'good' : 'warn'} />
              <StatCard label="Opp PPG" value={Number(defenseAllowed).toFixed(1)} hint={`${defenseAllowed <= 109 ? '-' : '+'}${Math.abs(Math.round(defenseAllowed - 110))} vs avg`} accent={defenseAllowed <= 110 ? 'good' : 'warn'} />
              <StatCard label="Team Value" value={toMoneyMillions(overview.teamValue || 0)} hint="Total Squad" />
              <StatCard label="Next Game" value={nextMatch ? formatDateShort(nextMatch.gameDate) : '-'} hint={nextOpponent ? `vs ${nextOpponent.shortName}` : 'No upcoming game'} />
              <StatCard
                label="Morale"
                value={overview.moraleLabel || (teamStreak >= 2 ? 'High' : teamStreak <= -2 ? 'Low' : 'Stable')}
                hint={`${Number.isFinite(Number(overview.moraleScore)) ? `${Math.round(Number(overview.moraleScore))}%` : ''} Team Spirit`.trim()}
                accent={Number(overview.moraleScore ?? 60) >= 60 ? 'good' : 'warn'}
              />
            </div>
          </section>

          <section className="dash-next-match">
            <header className="dash-section-head">
              <h2>Next Match</h2>
              <span>{nextMatch ? formatDateLong(nextMatch.gameDate) : '-'}</span>
            </header>
            {nextMatch ? (
              <div className="dash-next-match-body">
                <div className="dash-club-block">
                  <div className="dash-club-logo">{managedTeamShort}</div>
                  <h3>{managedTeamName}</h3>
                  <p>{teamRecordText} Record</p>
                  <div className="dash-token-row">
                    {lastFive.length > 0 ? lastFive.map((token, idx) => (
                      <span key={`${token}-${idx}`} className={`dash-result-token ${token === 'W' ? 'is-win' : token === 'L' ? 'is-loss' : ''}`}>{token}</span>
                    )) : <span className="dash-result-token">-</span>}
                  </div>
                </div>

                <div className="dash-tipoff-block">
                  <span>Tip-Off</span>
                  <strong>{formatTipoff(nextMatch.gameDate)}</strong>
                  <p>{formatDateLong(nextMatch.gameDate)}</p>
                  <div className="dash-next-match-actions">
                    <button
                      type="button"
                      className="dash-cta-primary"
                      onClick={() => { window.location.hash = `prepare?gameId=${nextMatch.id}`; }}
                    >
                      Prepare for Match
                    </button>
                    <button
                      type="button"
                      className="dash-cta-secondary"
                      onClick={() => { window.location.hash = `match-center?gameId=${nextMatch.id}`; }}
                    >
                      Match Analysis
                    </button>
                  </div>
                </div>

                <div className="dash-club-block">
                  <div className="dash-club-logo is-opponent">{nextOpponent?.shortName || '--'}</div>
                  <h3>{nextOpponent?.name || 'TBD'}</h3>
                  <p>Upcoming Opponent</p>
                  <div className="dash-token-row">
                    <span className="dash-result-token">Scouting</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dash-empty-inline">No upcoming fixture is available.</div>
            )}
          </section>

          <section className="dash-grid-two">
            <article className="dash-panel">
              <header className="dash-panel-head">
                <h3>Performance Trend</h3>
                <div className="dash-legend">
                  <span><i className="is-team" />{managedTeamShort}</span>
                  <span><i className="is-opponent" />Opponents</span>
                </div>
              </header>
              <PerformanceTrendChart data={trendSeries} />
            </article>

            <article className="dash-panel">
              <header className="dash-panel-head">
                <h3>Team Ratings</h3>
              </header>
              <TeamRadarChart values={radarValues} />
            </article>
          </section>

          <section className="dash-grid-two">
            <article className="dash-panel">
              <header className="dash-panel-head">
                <h3>Top Scorers</h3>
              </header>
              <div className="dash-list dash-scorers">
                {topScorers.length === 0 ? (
                  <div className="dash-list-item">No scoring leaders yet.</div>
                ) : topScorers.slice(0, 5).map((player, idx) => {
                  const games = Number(player.games ?? 0);
                  const totalPoints = Number(player.totalPoints ?? player.value ?? 0);
                  const ppg = games > 0 ? (totalPoints / games) : 0;
                  return (
                    <div key={`${player.name}-${idx}`} className="dash-list-item scorer-row">
                      <div className="scorer-rank">{idx + 1}</div>
                      <div className="scorer-avatar">{initials(player.name)}</div>
                      <div className="scorer-meta">
                        <strong>{player.name || 'Unknown Player'}</strong>
                        <span>{games} GP</span>
                      </div>
                      <div className="scorer-value">{ppg.toFixed(1)} <small>PPG</small></div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="dash-panel">
              <header className="dash-panel-head">
                <h3>Quick Actions</h3>
              </header>
              <div className="dash-alert-strip">
                <div className="dash-alert-strip-head">
                  <strong>Trade Alerts ⚠️</strong>
                  <span>{transferAlerts.length} active • {unreadInboxCount} unread</span>
                </div>
                {transferAlerts.length === 0 ? (
                  <div className="dash-alert-row">No new offers from clubs or agents.</div>
                ) : transferAlerts.map((item) => (
                  <button
                    key={`alert-${item.id}`}
                    type="button"
                    className="dash-alert-row"
                    onClick={() => { window.location.hash = 'inbox'; }}
                  >
                    <b>⚠️ {item.subject || 'Trade update'}</b>
                    <small>{item.body || 'Open Inbox for details.'}</small>
                  </button>
                ))}
              </div>
              <div className="dash-actions-grid">
                <ActionButton label="Squad" onClick={() => { window.location.hash = 'squad'; }} />
                <ActionButton label="Tactics" onClick={() => { window.location.hash = 'tactics'; }} />
                <ActionButton label="Transfers" onClick={() => { window.location.hash = 'transfers'; }} />
                <ActionButton label="Standings" onClick={() => { window.location.hash = 'league'; }} />
              </div>
              <div className="dash-season-progress">
                <div className="dash-progress-head">
                  <h4>Season Progress</h4>
                  <button type="button" className="dash-advance-btn" onClick={handleAdvance}>Advance Day</button>
                </div>
                <div className="dash-progress-line">
                  <span style={{ width: `${seasonProgressPct}%` }} />
                </div>
                <div className="dash-progress-meta">
                  <div>
                    <small>Regular Season</small>
                    <strong>{gamesPlayed}/82 Games</strong>
                  </div>
                  <div>
                    <small>Games Remaining</small>
                    <strong>{gamesRemaining}</strong>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="dash-grid-two">
            <article className="dash-panel">
              <header className="dash-panel-head">
                <h3>Upcoming Fixtures</h3>
              </header>
              <div className="dash-list">
                {upcomingFixtures.length === 0 && (
                  <div className="dash-list-item">No upcoming fixtures.</div>
                )}
                {upcomingFixtures.map((fixture) => {
                  const managedIsHome = fixture.homeTeamId === managedTeamId;
                  const opponent = managedIsHome ? fixture.awayTeam : fixture.homeTeam;
                  return (
                    <div key={fixture.id} className="dash-list-item fixture-row">
                      <div className="fixture-left">
                        <div className="fixture-teams">
                          <span>{managedTeamShort}</span>
                          <b>vs</b>
                          <span>{opponent?.shortName || '--'}</span>
                        </div>
                        <div className="fixture-date">{formatFixtureDate(fixture.gameDate)}</div>
                      </div>
                      <button className="dash-pill-btn" type="button" onClick={() => { window.location.hash = `prepare?gameId=${fixture.id}`; }}>
                        Prepare
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="dash-panel">
              <header className="dash-panel-head">
                <h3>Recent Results</h3>
              </header>
              <div className="dash-list">
                {recentResults.length === 0 && (
                  <div className="dash-list-item">No completed matches.</div>
                )}
                {recentResults.map((game) => {
                  const managedIsHome = game.homeTeamId === managedTeamId;
                  const managedScore = managedIsHome ? game.homeScore : game.awayScore;
                  const oppScore = managedIsHome ? game.awayScore : game.homeScore;
                  const won = managedScore > oppScore;
                  const managedShort = managedIsHome ? game.homeTeam.shortName : game.awayTeam.shortName;
                  const oppShort = managedIsHome ? game.awayTeam.shortName : game.homeTeam.shortName;
                  return (
                    <div key={game.id} className="dash-list-item result-row">
                      <div>
                        <div className="dash-list-main">{managedShort} {managedScore} - {oppScore} {oppShort}</div>
                        <div className="dash-list-sub">{formatDateShort(game.gameDate)}</div>
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

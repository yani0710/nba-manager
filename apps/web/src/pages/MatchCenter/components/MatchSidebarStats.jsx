function pct(made, att) {
  if (!att) return '0.0%';
  return `${((made / att) * 100).toFixed(1)}%`;
}

function topBy(list, field) {
  return [...list].sort((a, b) => Number(b?.[field] ?? 0) - Number(a?.[field] ?? 0))[0] || null;
}

export function MatchSidebarStats({
  homeTeam,
  awayTeam,
  homeStats,
  awayStats,
  homePlayers,
  awayPlayers,
}) {
  const homeRows = Object.values(homePlayers || {});
  const awayRows = Object.values(awayPlayers || {});
  const topScorer = topBy([...homeRows, ...awayRows], 'points');
  const topAssist = topBy([...homeRows, ...awayRows], 'assists');
  const topRebound = topBy([...homeRows, ...awayRows], 'rebounds');

  return (
    <aside className="md-side-panel ui-card">
      <h3>Live Box Score</h3>
      <div className="md-mini-table">
        <div className="head"><span>Team</span><span>PTS</span><span>REB</span><span>AST</span><span>TOV</span></div>
        <div><span>{awayTeam?.shortName}</span><span>{awayStats.pts}</span><span>{awayStats.reb}</span><span>{awayStats.ast}</span><span>{awayStats.tov}</span></div>
        <div><span>{homeTeam?.shortName}</span><span>{homeStats.pts}</span><span>{homeStats.reb}</span><span>{homeStats.ast}</span><span>{homeStats.tov}</span></div>
      </div>

      <div className="md-side-cards">
        <article><small>Team Fouls</small><strong>{awayStats.teamFouls} / {homeStats.teamFouls}</strong></article>
        <article><small>Timeouts</small><strong>{awayStats.timeouts} / {homeStats.timeouts}</strong></article>
        <article><small>FG%</small><strong>{pct(awayStats.fgMade, awayStats.fgAtt)} / {pct(homeStats.fgMade, homeStats.fgAtt)}</strong></article>
        <article><small>3PT%</small><strong>{pct(awayStats.threeMade, awayStats.threeAtt)} / {pct(homeStats.threeMade, homeStats.threeAtt)}</strong></article>
      </div>

      <div className="md-leaders">
        <h4>Top Performers</h4>
        <p><strong>PTS:</strong> {topScorer?.name || '-'} ({topScorer?.points || 0})</p>
        <p><strong>AST:</strong> {topAssist?.name || '-'} ({topAssist?.assists || 0})</p>
        <p><strong>REB:</strong> {topRebound?.name || '-'} ({topRebound?.rebounds || 0})</p>
      </div>

    </aside>
  );
}

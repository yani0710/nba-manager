const COURT_POS = {
  away: {
    PG: { x: 16, y: 65 },
    SG: { x: 22, y: 45 },
    SF: { x: 32, y: 72 },
    PF: { x: 36, y: 34 },
    C: { x: 28, y: 22 },
  },
  home: {
    PG: { x: 84, y: 65 },
    SG: { x: 78, y: 45 },
    SF: { x: 68, y: 72 },
    PF: { x: 64, y: 34 },
    C: { x: 72, y: 22 },
  },
};

export function LiveCourtPanel({
  game,
  homeLineup,
  awayLineup,
  possessionSide,
  activePlayerId,
}) {
  if (!game) return null;
  const tokens = [
    ...Object.entries(awayLineup || {}).map(([pos, player]) => ({ team: 'away', pos, player })),
    ...Object.entries(homeLineup || {}).map(([pos, player]) => ({ team: 'home', pos, player })),
  ];

  return (
    <section className="md-court-panel ui-card">
      <div className="md-panel-head">
        <h3>Live Court View</h3>
        <span className="ui-badge">{possessionSide === 'home' ? game.homeTeam?.shortName : game.awayTeam?.shortName} offense</span>
      </div>
      <div className="md-court">
        <div className="md-court-centerline" />
        <div className="md-court-circle" />
        <div className="md-court-left-key" />
        <div className="md-court-right-key" />
        <div className="md-court-left-three" />
        <div className="md-court-right-three" />
        {tokens.map((row) => {
          const spot = COURT_POS[row.team][row.pos];
          const isBall = row.player?.id === activePlayerId;
          const onOffense = row.team === possessionSide;
          return (
            <div
              key={`${row.team}-${row.pos}-${row.player?.id ?? 'x'}`}
              className={`md-player-token ${row.team} ${onOffense ? 'offense' : 'defense'} ${isBall ? 'ball' : ''}`}
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              title={`${row.player?.name || 'Unassigned'} (${row.pos})`}
            >
              <span>{row.pos}</span>
              <small>{row.player?.name || 'Bench'}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}


import { formatFixtureDateTime } from '../../../domain/fixtures';
import { formatClock, quarterLabel } from '../matchSimUtils';

function logoFor(team) {
  const short = (team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
}

export function MatchHeaderBar({
  game,
  homeScore,
  awayScore,
  quarter,
  gameClockSeconds,
  shotClock,
  possessionSide,
  speed,
  running,
  simMode,
  matchState,
  onToggleRunning,
  onSetSpeed,
  onSetMode,
}) {
  if (!game) return null;
  const quarterText = quarterLabel(quarter);

  return (
    <header className="md-scoreboard">
      <div className="md-team md-team-away">
        <img src={logoFor(game.awayTeam)} alt={game.awayTeam?.shortName || 'Away'} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div>
          <strong>{game.awayTeam?.shortName || 'AWY'}</strong>
          <small>{game.awayTeam?.name || 'Away'}</small>
        </div>
      </div>

      <div className="md-score-center">
        <div className="md-score-main">
          <strong>{awayScore}</strong>
          <span>@</span>
          <strong>{homeScore}</strong>
        </div>
        <div className="md-score-meta">
          <span>{quarterText}</span>
          <span>{formatClock(gameClockSeconds)}</span>
          <span>SC {shotClock}s</span>
          <span className={`md-possession ${possessionSide === 'home' ? 'home' : 'away'}`}>
            Poss: {possessionSide === 'home' ? game.homeTeam?.shortName : game.awayTeam?.shortName}
          </span>
          <span>{formatFixtureDateTime(game.gameDate)}</span>
        </div>
      </div>

      <div className="md-team md-team-home">
        <img src={logoFor(game.homeTeam)} alt={game.homeTeam?.shortName || 'Home'} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div>
          <strong>{game.homeTeam?.shortName || 'HME'}</strong>
          <small>{game.homeTeam?.name || 'Home'}</small>
        </div>
      </div>

      <div className="md-header-controls">
        <div className="md-mode-toggle">
          <button className={`ui-btn ${simMode === 'watch' ? 'ui-btn-primary' : ''}`} type="button" onClick={() => onSetMode('watch')}>Watch</button>
          <button className={`ui-btn ${simMode === 'simulate' ? 'ui-btn-primary' : ''}`} type="button" onClick={() => onSetMode('simulate')}>Simulate</button>
        </div>
        <div className="md-speed">
          <span>Speed</span>
          <select className="ui-select" value={speed} onChange={(e) => onSetSpeed(Number(e.target.value))}>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={8}>8x</option>
          </select>
        </div>
        <button className="ui-btn ui-btn-primary" type="button" onClick={onToggleRunning}>
          {running ? 'Pause' : 'Continue'}
        </button>
        <span className="ui-badge">{matchState}</span>
      </div>
    </header>
  );
}

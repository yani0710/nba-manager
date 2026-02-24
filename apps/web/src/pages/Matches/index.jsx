import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../Matches.css';

export function Matches() {
  const { scheduleGames, fetchSchedule, loading } = useGameStore();
  const getLogoPath = (team) => {
    const short = (team?.shortName || '').toLowerCase();
    return team?.logoPath || `/images/teams/${short}.png`;
  };

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const groupedByWeek = useMemo(() => {
    const map = new Map();
    for (const game of scheduleGames) {
      const date = new Date(game.gameDate);
      const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)}`;
      if (!map.has(weekKey)) {
        map.set(weekKey, []);
      }
      map.get(weekKey).push(game);
    }
    return [...map.entries()];
  }, [scheduleGames]);

  if (loading) return <div>Loading matches...</div>;

  return (
    <div className="matches-page">
      <h2>Match Schedule</h2>
      {groupedByWeek.length === 0 && <p>No schedule available.</p>}
      {groupedByWeek.map(([week, games]) => (
        <div key={week} className="matches-placeholder" style={{ marginBottom: 16 }}>
          <h3>{week}</h3>
          {games.map((game) => (
            <div key={game.id} className="match-card" style={{ marginBottom: 8 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={getLogoPath(game.awayTeam)} alt={game.awayTeam.shortName} style={{ width: 20, height: 20 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                {game.awayTeam.shortName} @ {game.homeTeam.shortName}
                <img src={getLogoPath(game.homeTeam)} alt={game.homeTeam.shortName} style={{ width: 20, height: 20 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </strong>
              <span>
                {new Date(game.gameDate).toLocaleDateString()} | {game.status === 'final' ? `${game.awayScore}-${game.homeScore}` : 'Scheduled'}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}


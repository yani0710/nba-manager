import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonCard } from '../../components/ui';
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

  if (loading) return <SkeletonCard />;

  return (
    <div className="matches-page">
      <PageHeader title="Matches" subtitle="Weekly grouped fixture list with status badges." />
      {groupedByWeek.length === 0 && <EmptyState title="No schedule available" description="Load a save schedule to see upcoming and completed games." />}
      {groupedByWeek.map(([week, games]) => (
        <div key={week} className="ui-card" style={{ marginBottom: 16 }}>
          <h3>{week}</h3>
          {games.map((game) => (
            <div key={game.id} className="match-card" style={{ marginBottom: 8, border: '1px solid var(--ui-border)', borderRadius: 12, padding: 10, background: 'var(--ui-bg-elev-2)' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={getLogoPath(game.awayTeam)} alt={game.awayTeam.shortName} style={{ width: 20, height: 20 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                {game.awayTeam.shortName} @ {game.homeTeam.shortName}
                <img src={getLogoPath(game.homeTeam)} alt={game.homeTeam.shortName} style={{ width: 20, height: 20 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </strong>
              <span style={{ color: 'var(--ui-text-muted)' }}>
                {new Date(game.gameDate).toLocaleDateString()} | {game.status === 'final' ? `${game.awayScore}-${game.homeScore}` : 'Scheduled'}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}


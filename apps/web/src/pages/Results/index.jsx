import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader } from '../../components/ui';
import '../Matches.css';

const logoPath = (team) => {
  const short = (team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
};

export function Results() {
  const { results, fetchResults, fetchResultDetails } = useGameStore();
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const openMatch = async (gameId) => {
    const details = await fetchResultDetails(gameId);
    setSelected(details);
  };

  if (selected) {
    return (
      <div className="matches-page">
        <PageHeader
          title="Match Center"
          subtitle="Detailed result summary and top performers."
          actions={<button className="ui-btn" onClick={() => setSelected(null)}>Back to Results</button>}
        />
        <div className="ui-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={logoPath(selected.homeTeam)} alt={selected.homeTeam.shortName} style={{ width: 28, height: 28 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <strong>{selected.homeTeam.shortName}</strong>
          </div>
          <span style={{ fontSize: 18 }}>{selected.homeScore} - {selected.awayScore}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{selected.awayTeam.shortName}</strong>
            <img src={logoPath(selected.awayTeam)} alt={selected.awayTeam.shortName} style={{ width: 28, height: 28 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        </div>
        <div className="ui-card" style={{ marginBottom: 12 }}>
          <strong>Player of the Match:</strong>
          <span>{selected.playerOfTheMatch?.name || '-'} ({selected.playerOfTheMatch?.points || 0} pts)</span>
        </div>
        <div className="ui-card" style={{ marginBottom: 12 }}>
          <strong>Top Scorer:</strong>
          <span>{selected.topScorer?.name || '-'} ({selected.topScorer?.points || 0} pts)</span>
        </div>
        <div className="ui-card">
          <h3>Basic Team Stats</h3>
          <p>{selected.homeTeam.shortName} - PTS {selected.basicStats.home.points} | REB {selected.basicStats.home.rebounds} | AST {selected.basicStats.home.assists}</p>
          <p>{selected.awayTeam.shortName} - PTS {selected.basicStats.away.points} | REB {selected.basicStats.away.rebounds} | AST {selected.basicStats.away.assists}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="matches-page">
      <PageHeader title="Results" subtitle="Browse completed games and open a full match center summary." />
      {results.length === 0 && <EmptyState title="No completed matches" description="Advance the schedule to generate final results." />}
      {results.map((game) => (
        <div key={game.id} className="ui-card" style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={logoPath(game.awayTeam)} alt={game.awayTeam.shortName} style={{ width: 22, height: 22 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <strong>{game.awayTeam.shortName}</strong>
          </div>
          <span>{game.awayScore} - {game.homeScore}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong>{game.homeTeam.shortName}</strong>
            <img src={logoPath(game.homeTeam)} alt={game.homeTeam.shortName} style={{ width: 22, height: 22 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <button className="ui-btn" onClick={() => openMatch(game.id)}>Open</button>
        </div>
      ))}
    </div>
  );
}

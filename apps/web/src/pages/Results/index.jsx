import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
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
        <button className="btn-small" onClick={() => setSelected(null)}>Back to Results</button>
        <h2>Match Center</h2>
        <div className="match-card" style={{ marginBottom: 12 }}>
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
        <div className="match-card" style={{ marginBottom: 12 }}>
          <strong>Player of the Match:</strong>
          <span>{selected.playerOfTheMatch?.name || '-'} ({selected.playerOfTheMatch?.points || 0} pts)</span>
        </div>
        <div className="match-card" style={{ marginBottom: 12 }}>
          <strong>Top Scorer:</strong>
          <span>{selected.topScorer?.name || '-'} ({selected.topScorer?.points || 0} pts)</span>
        </div>
        <div className="match-card">
          <h3>Basic Team Stats</h3>
          <p>{selected.homeTeam.shortName} - PTS {selected.basicStats.home.points} | REB {selected.basicStats.home.rebounds} | AST {selected.basicStats.home.assists}</p>
          <p>{selected.awayTeam.shortName} - PTS {selected.basicStats.away.points} | REB {selected.basicStats.away.rebounds} | AST {selected.basicStats.away.assists}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="matches-page">
      <h2>Results</h2>
      {results.length === 0 && <p>No completed matches yet.</p>}
      {results.map((game) => (
        <div key={game.id} className="match-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={logoPath(game.awayTeam)} alt={game.awayTeam.shortName} style={{ width: 22, height: 22 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <strong>{game.awayTeam.shortName}</strong>
          </div>
          <span>{game.awayScore} - {game.homeScore}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong>{game.homeTeam.shortName}</strong>
            <img src={logoPath(game.homeTeam)} alt={game.homeTeam.shortName} style={{ width: 22, height: 22 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <button className="btn-small" onClick={() => openMatch(game.id)}>Open</button>
        </div>
      ))}
    </div>
  );
}

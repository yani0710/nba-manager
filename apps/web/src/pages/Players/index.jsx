import { useEffect } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../Player.css';

export function Players() {
  const { players, fetchPlayers, loading } = useGameStore();

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  if (loading) return <div>Loading players...</div>;

  return (
    <div className="player-page">
      <h2>All Players</h2>
      <div className="players-table-container">
        <table className="players-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>#</th>
              <th>Position</th>
              <th>Salary</th>
            </tr>
          </thead>
          <tbody>
            {players.slice(0, 100).map((player) => (
              <tr key={player.id}>
                <td className="player-name">{player.name}</td>
                <td>{player.team?.shortName}</td>
                <td className="number">{player.number}</td>
                <td>{player.position}</td>
                <td>${(player.salary / 1000000).toFixed(2)}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

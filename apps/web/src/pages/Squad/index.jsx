import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../Player.css';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export function Squad() {
  const { currentSave, squadPlayers, fetchSquad, saveRotation, loading } = useGameStore();
  const [rotation, setRotation] = useState({});

  useEffect(() => {
    fetchSquad();
  }, [fetchSquad]);

  useEffect(() => {
    setRotation(currentSave?.data?.rotation ?? {});
  }, [currentSave]);

  const options = useMemo(() => squadPlayers.map((p) => ({ id: p.id, label: `${p.name} (${p.position})` })), [squadPlayers]);

  if (!currentSave?.data?.career?.teamShortName) {
    return <div className="player-page"><h2>Squad</h2><p>Start with a team to see your squad.</p></div>;
  }

  if (loading) return <div>Loading squad...</div>;

  return (
    <div className="player-page">
      <h2>Squad - {currentSave.data.career.teamShortName}</h2>

      <div className="player-info-card" style={{ marginBottom: 16 }}>
        <h3>Starting 5</h3>
        <div className="info-grid">
          {POSITIONS.map((pos) => (
            <label key={pos} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong>{pos}</strong>
              <select
                value={rotation[pos] ?? ''}
                onChange={(e) => setRotation((prev) => ({ ...prev, [pos]: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Select player</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => saveRotation(rotation)}>
          Save Rotation
        </button>
      </div>

      <div className="players-table-container">
        <table className="players-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Position</th>
              <th>Salary</th>
            </tr>
          </thead>
          <tbody>
            {squadPlayers.map((player) => (
              <tr key={player.id}>
                <td>{player.number ?? '-'}</td>
                <td className="player-name">{player.name}</td>
                <td>{player.position}</td>
                <td>${((player.salary ?? 0) / 1000000).toFixed(1)}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

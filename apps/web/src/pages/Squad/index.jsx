import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonTable } from '../../components/ui';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export function Squad() {
  const { currentSave, squadPlayers, fetchSquad, saveRotation, loading } = useGameStore();
  const [rotation, setRotation] = useState({});
  const teamShortName = currentSave?.data?.career?.teamShortName ?? null;

  useEffect(() => {
    if (!teamShortName) return;
    fetchSquad();
  }, [fetchSquad, currentSave?.id, teamShortName]);
  useEffect(() => { setRotation(currentSave?.data?.rotation ?? {}); }, [currentSave]);

  const options = useMemo(
    () => squadPlayers.map((p) => ({ id: p.id, label: `${p.name} (${p.position})` })),
    [squadPlayers],
  );

  if (!teamShortName) {
    return (
      <div>
        <PageHeader title="Squad" subtitle="Manage starters, rotation and salary overview." />
        <EmptyState title="No managed team" description="Start or load a career with a team to view your roster." />
      </div>
    );
  }

  if (loading) return <SkeletonTable rows={8} cols={4} />;

  return (
    <div>
      <PageHeader title={`Squad - ${teamShortName}`} subtitle="Set your starting five and review roster contracts." />

      <div className="ui-card-grid">
        <section className="ui-card ui-col-4">
          <h3>Starting Five</h3>
          <div className="ui-list-stack">
            {POSITIONS.map((pos) => (
              <label key={pos} style={{ display: 'grid', gap: 6 }}>
                <strong>{pos}</strong>
                <select
                  className="ui-select"
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
            <button className="ui-btn ui-btn-primary" onClick={() => saveRotation(rotation)}>Save Rotation</button>
          </div>
        </section>

        <section className="ui-card ui-col-8">
          <h3>Roster Table</h3>
          {squadPlayers.length === 0 ? (
            <EmptyState title="No squad players" description="Roster data is empty for the managed team." />
          ) : (
            <div className="ui-table-shell">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Position</th>
                    <th className="ui-num">Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {squadPlayers.map((player) => (
                    <tr key={player.id}>
                      <td>{player.number ?? '-'}</td>
                      <td>{player.name}</td>
                      <td><span className="ui-badge">{player.position}</span></td>
                      <td className="ui-num">${((player.salary ?? 0) / 1000000).toFixed(1)}M</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

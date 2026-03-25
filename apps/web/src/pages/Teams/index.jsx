import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonCard } from '../../components/ui';

export function Teams() {
  const { teams, fetchTeams, loading, currentSave } = useGameStore();
  const [selectedTeam, setSelectedTeam] = useState(null);

  const getLogoPath = (team) => {
    const short = (team?.shortName || '').toLowerCase();
    const aliases = { bkn: 'brk' };
    return team?.logoPath || `/images/teams/${aliases[short] || short}.png`;
  };

  useEffect(() => { fetchTeams(); }, [fetchTeams, currentSave?.id]);
  useEffect(() => {
    if (!teams.length) return;
    if (selectedTeam && teams.some((t) => t.id === selectedTeam.id)) return;
    const managedCode = currentSave?.data?.career?.teamShortName;
    const managedTeam = teams.find((t) => t.shortName === managedCode);
    setSelectedTeam(managedTeam || teams[0]);
  }, [teams, selectedTeam, currentSave?.data?.career?.teamShortName]);

  return (
    <div>
      <PageHeader title="Teams" subtitle="League directory with quick roster and form preview." />

      {loading ? (
        <div className="ui-card-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="ui-col-4"><SkeletonCard /></div>)}
        </div>
      ) : null}

      {!loading && teams.length === 0 ? (
        <EmptyState title="No teams loaded" description="Load teams data to browse league rosters." />
      ) : null}

      {!loading && teams.length > 0 ? (
        <div className="ui-card-grid">
          <section className="ui-card ui-col-7">
            <h3>Team Directory</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className="ui-list-item"
                  style={{ textAlign: 'left', cursor: 'pointer', background: selectedTeam?.id === team.id ? 'var(--ui-accent-soft)' : undefined }}
                  onClick={() => setSelectedTeam(team)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <img src={getLogoPath(team)} alt={team.name} style={{ width: 28, height: 28, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <strong>{team.shortName}</strong>
                  </div>
                  <div>{team.name}</div>
                  <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>{team.city}</div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    <span className="ui-badge">Form {team.form ?? 50}</span>{' '}
                    <span className="ui-badge">{team.last5 || '-----'}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="ui-card ui-col-5">
            <h3>Team Detail</h3>
            {!selectedTeam ? (
              <EmptyState title="Select a team" description="Pick a team from the directory to inspect roster and form." />
            ) : (
              <div className="ui-list-stack">
                <div className="ui-list-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={getLogoPath(selectedTeam)} alt={selectedTeam.name} style={{ width: 44, height: 44, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{selectedTeam.name}</div>
                      <div style={{ color: 'var(--ui-text-muted)', fontSize: 13 }}>{selectedTeam.city}</div>
                    </div>
                  </div>
                </div>
                <div className="ui-list-item">Form: {selectedTeam.form ?? 50}</div>
                <div className="ui-list-item">Last 5: {selectedTeam.last5 || '-'}</div>
                <div className="ui-list-item">Streak: {selectedTeam.streak ?? 0}</div>
                <div className="ui-list-item">Roster Size: {selectedTeam.players?.length ?? 0}</div>
                <div className="ui-table-shell">
                  <table className="ui-table">
                    <thead><tr><th>#</th><th>Name</th><th>Pos</th><th className="ui-num">Salary</th></tr></thead>
                    <tbody>
                      {(selectedTeam.players ?? []).map((player) => (
                        <tr key={player.id}>
                          <td>{player.jerseyCode ?? player.jerseyNumber ?? player.number ?? '-'}</td>
                          <td>{player.name}</td>
                          <td>{player.position}</td>
                      <td className="ui-num">{player.salary ? `$${((player.salary / 1000000)).toFixed(1)}M` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

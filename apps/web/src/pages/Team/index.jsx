import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../Teams.css';

export function Team() {
  const { teams, fetchTeams, loading, currentSave } = useGameStore();
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams, currentSave?.id]);

  // In a real app, you'd get teamId from route params
  // For now this is a fallback - same as Teams roster detail
  if (loading) return <div>Loading team...</div>;

  return (
    <div className="team-detail-page">
      <h2>Team Management</h2>
      <div className="teams-grid">
        {teams.map((team) => (
          <div
            key={team.id}
            className="team-card"
            onClick={() => setSelectedTeam(team)}
          >
            <h3>{team.shortName}</h3>
            <p>{team.name}</p>
            <p className="city">{team.city}</p>
            <p className="city">Form: {team.form ?? 50}</p>
            <p className="city">Last5: {team.last5 || '-'}</p>
            <p className="players">↳ {team.players?.length || 0} players</p>
          </div>
        ))}
      </div>

      {selectedTeam && (
        <div className="team-detail">
          <h2>{selectedTeam.name}</h2>
          <div className="team-info">
            <p><strong>City:</strong> {selectedTeam.city}</p>
            <p><strong>Short Name:</strong> {selectedTeam.shortName}</p>
            <p><strong>Team Form:</strong> {selectedTeam.form ?? 50}</p>
            <p><strong>Last5:</strong> {selectedTeam.last5 || '-'}</p>
            <p><strong>Streak:</strong> {selectedTeam.streak ?? 0}</p>
          </div>
          
          <h3>Roster ({selectedTeam.players?.length})</h3>
          <table className="roster-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Position</th>
                <th>Salary</th>
              </tr>
            </thead>
            <tbody>
              {selectedTeam.players?.map((player) => (
                <tr key={player.id}>
                  <td>{player.number}</td>
                  <td>{player.name}</td>
                  <td>{player.position}</td>
                  <td>${(player.salary / 1000000).toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

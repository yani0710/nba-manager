import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../Teams.css';

export function Teams() {
  const { teams, fetchTeams, loading, currentSave } = useGameStore();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const getLogoPath = (team) => {
    const short = (team.shortName || '').toLowerCase();
    const aliases = { bkn: 'brk' };
    return team.logoPath || `/images/teams/${aliases[short] || short}.png`;
  };

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams, currentSave?.id]);

  if (loading) return <div>Loading teams...</div>;

  return (
    <div className="teams-page">
      <div className="teams-grid">
        {teams.map((team) => (
          <div
            key={team.id}
            className="team-card"
            onClick={() => setSelectedTeam(team)}
          >
            <img
              src={getLogoPath(team)}
              alt={`${team.name} logo`}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{ width: 48, height: 48, objectFit: 'contain' }}
            />
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
          <img
            src={getLogoPath(selectedTeam)}
            alt={`${selectedTeam.name} logo`}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: 72, height: 72, objectFit: 'contain' }}
          />
          <h2>{selectedTeam.name}</h2>
          <p>City: {selectedTeam.city}</p>
          <p>Team form: {selectedTeam.form ?? 50}</p>
          <p>Last5: {selectedTeam.last5 || '-'}</p>
          <p>Streak: {selectedTeam.streak ?? 0}</p>
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

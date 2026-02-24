import { useEffect } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../Dashboard.css';

export function Dashboard() {
  const {
    currentSave,
    teams,
    dashboard,
    inbox,
    nextMatchScouting,
    advanceSave,
    fetchTeams,
    fetchDashboard,
    fetchNextMatchScouting,
  } = useGameStore();
  const careerTeamCode = currentSave?.data?.career?.teamShortName;
  const careerTeam = teams.find((team) => team.shortName === careerTeamCode);
  const getLogoPath = (team) => {
    const short = (team?.shortName || '').toLowerCase();
    return team?.logoPath || `/images/teams/${short}.png`;
  };

  useEffect(() => {
    fetchTeams();
    fetchDashboard();
    fetchNextMatchScouting();
  }, [fetchTeams, fetchDashboard, fetchNextMatchScouting]);

  const handleAdvance = async () => {
    if (currentSave) {
      await advanceSave(currentSave.id);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        <div className="card">
          <h3>Current Save</h3>
          {currentSave ? (
            <div>
              <p><strong>Name:</strong> {currentSave.name}</p>
              <p><strong>Season:</strong> {currentSave.data.season}</p>
              <p><strong>Week:</strong> {currentSave.data.week}</p>
              <p><strong>Date:</strong> {currentSave.data.currentDate || 'N/A'}</p>
              <button onClick={handleAdvance} className="btn-primary">
                Advance Day
              </button>
            </div>
          ) : (
            <p>No save loaded</p>
          )}
        </div>

        <div className="card">
          <h3>Next Match</h3>
          {dashboard?.nextMatch ? (
            <div>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={getLogoPath(dashboard.nextMatch.awayTeam)} alt={dashboard.nextMatch.awayTeam.shortName} style={{ width: 20, height: 20 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                {dashboard.nextMatch.awayTeam.shortName} @ {dashboard.nextMatch.homeTeam.shortName}
                <img src={getLogoPath(dashboard.nextMatch.homeTeam)} alt={dashboard.nextMatch.homeTeam.shortName} style={{ width: 20, height: 20 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </p>
              <p>{new Date(dashboard.nextMatch.gameDate).toLocaleDateString()}</p>
            </div>
          ) : (
            <p>No upcoming match scheduled.</p>
          )}
        </div>

        <div className="card">
          <h3>Next Match Scouting</h3>
          {nextMatchScouting ? (
            <div>
              <p><strong>Opponent:</strong> {nextMatchScouting.opponent.shortName}</p>
              <p><strong>Venue:</strong> {nextMatchScouting.venue}</p>
              <p><strong>Date:</strong> {new Date(nextMatchScouting.date).toLocaleDateString()}</p>
              <p><strong>Your Last 5:</strong> {(nextMatchScouting.last5.managed || []).join(' ') || '-'}</p>
              <p><strong>Opponent Last 5:</strong> {(nextMatchScouting.last5.opponent || []).join(' ') || '-'}</p>
            </div>
          ) : (
            <p>No scouting data available.</p>
          )}
        </div>

        <div className="card">
          <h3>Recent Results</h3>
          {dashboard?.recentResults?.length ? (
            dashboard.recentResults.map((game) => (
              <p key={game.id}>
                {game.awayTeam.shortName} {game.awayScore} - {game.homeScore} {game.homeTeam.shortName}
              </p>
            ))
          ) : (
            <p>No recent results yet.</p>
          )}
        </div>

        <div className="card">
          <h3>Last Result</h3>
          {dashboard?.recentResults?.[0] ? (
            <p>
              {dashboard.recentResults[0].awayTeam.shortName} {dashboard.recentResults[0].awayScore} - {dashboard.recentResults[0].homeScore} {dashboard.recentResults[0].homeTeam.shortName}
            </p>
          ) : (
            <p>No completed games yet.</p>
          )}
        </div>

        <div className="card">
          <h3>League Table Snippet</h3>
          {dashboard?.standings?.slice(0, 5).map((row, index) => (
            <p key={row.shortName}>
              {index + 1}. {row.shortName} ({row.wins}-{row.losses})
            </p>
          ))}
        </div>

        <div className="card">
          <h3>Team News</h3>
          <p><strong>Inbox unread:</strong> {dashboard?.inbox?.unread ?? 0}</p>
          {(dashboard?.inbox?.latest ?? []).map((item) => (
            <p key={item.id}>| {item.subject}</p>
          ))}
        </div>

        <div className="card">
          <h3>Injuries Snapshot</h3>
          {dashboard?.injuries?.length ? (
            dashboard.injuries.map((injury, idx) => (
              <p key={`${injury.playerName}-${idx}`}>
                {injury.playerName}: {injury.injury} ({injury.expectedReturnWeeks}w)
              </p>
            ))
          ) : (
            <p>No current injuries reported.</p>
          )}
        </div>

        <div className="card">
          <h3>Training Snapshot</h3>
          <p><strong>Rating:</strong> {dashboard?.training?.rating ?? 74}</p>
          <p><strong>Trend:</strong> {dashboard?.training?.trend ?? 'steady'}</p>
        </div>

        <div className="card">
          <h3>Manager Profile</h3>
          <p><strong>Manager:</strong> {currentSave?.data?.manager?.name || 'N/A'}</p>
          <p><strong>Username:</strong> @{currentSave?.data?.manager?.username || 'N/A'}</p>
          <p><strong>Career:</strong> {currentSave?.data?.career?.unemployed ? 'Unemployed' : (careerTeam?.name || careerTeamCode)}</p>
        </div>

        <div className="card">
          <h3>Quick Stats</h3>
          <p>Teams: {teams.length}</p>
          <p>Inbox: {inbox?.unread ?? currentSave?.data?.inboxUnread ?? 0}</p>
          <p>Team: {careerTeam?.name || 'No Club'}</p>
        </div>
      </div>
    </div>
  );
}


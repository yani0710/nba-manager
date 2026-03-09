import { useEffect } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, StatGrid } from '../../components/ui';

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

  useEffect(() => {
    fetchTeams();
    fetchDashboard();
    fetchNextMatchScouting();
  }, [fetchTeams, fetchDashboard, fetchNextMatchScouting]);

  const handleAdvance = async () => {
    if (currentSave) await advanceSave(currentSave.id);
  };

  const statItems = [
    { label: 'Week', value: currentSave?.data?.week ?? '-', help: currentSave?.data?.currentDate || 'No active date' },
    { label: 'Unread Inbox', value: dashboard?.inbox?.unread ?? inbox?.unread ?? 0 },
    { label: 'Career Team', value: careerTeam?.shortName || careerTeamCode || 'FA' },
    { label: 'Training Rating', value: dashboard?.training?.rating ?? 74, help: dashboard?.training?.trend ?? 'steady' },
  ];

  const recentResults = dashboard?.recentResults ?? [];

  return (
    <div>
      <PageHeader
        title="Home Dashboard"
        subtitle="A quick view of schedule, scouting, club health, and recent league activity."
        actions={<button className="ui-btn ui-btn-primary" onClick={handleAdvance}>Advance Day</button>}
      />

      <StatGrid items={statItems} />

      <div className="ui-card-grid">
        <section className="ui-card ui-col-4">
          <h3>Current Save</h3>
          {currentSave ? (
            <div className="ui-list-stack">
              <div><strong>Name:</strong> {currentSave.name}</div>
              <div><strong>Season:</strong> {currentSave.data.season}</div>
              <div><strong>Week:</strong> {currentSave.data.week}</div>
              <div><strong>Date:</strong> {currentSave.data.currentDate || 'N/A'}</div>
            </div>
          ) : (
            <EmptyState title="No save loaded" description="Load a save to start managing your franchise." />
          )}
        </section>

        <section className="ui-card ui-col-4">
          <h3>Next Match</h3>
          {dashboard?.nextMatch ? (
            <div className="ui-list-stack">
              <div>{dashboard.nextMatch.awayTeam.shortName} @ {dashboard.nextMatch.homeTeam.shortName}</div>
              <div>{new Date(dashboard.nextMatch.gameDate).toLocaleDateString()}</div>
            </div>
          ) : (
            <EmptyState title="No upcoming match" description="No scheduled fixture available yet." />
          )}
        </section>

        <section className="ui-card ui-col-4">
          <h3>Scouting Preview</h3>
          {nextMatchScouting ? (
            <div className="ui-list-stack">
              <div><strong>Opponent:</strong> {nextMatchScouting.opponent.shortName}</div>
              <div><strong>Venue:</strong> {nextMatchScouting.venue}</div>
              <div><strong>Date:</strong> {new Date(nextMatchScouting.date).toLocaleDateString()}</div>
              <div><strong>Your Last 5:</strong> {(nextMatchScouting.last5.managed || []).join(' ') || '-'}</div>
              <div><strong>Opponent Last 5:</strong> {(nextMatchScouting.last5.opponent || []).join(' ') || '-'}</div>
            </div>
          ) : (
            <EmptyState title="No scouting preview" description="Scouting details will appear when the next fixture is available." />
          )}
        </section>

        <section className="ui-card ui-col-6">
          <h3>Recent Results</h3>
          {recentResults.length === 0 ? (
            <EmptyState title="No recent results" description="Simulate or load completed games to populate this feed." />
          ) : (
            <div className="ui-list-stack">
              {recentResults.map((game) => (
                <div key={game.id} className="ui-list-item">
                  {game.awayTeam.shortName} {game.awayScore} - {game.homeScore} {game.homeTeam.shortName}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ui-card ui-col-6">
          <h3>League Snapshot</h3>
          {(dashboard?.standings?.length ?? 0) > 0 ? (
            <div className="ui-list-stack">
              {dashboard.standings.slice(0, 5).map((row, index) => (
                <div key={row.shortName} className="ui-list-item">
                  <span className="ui-badge">{index + 1}</span>{' '}
                  {row.shortName} ({row.wins}-{row.losses})
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Standings unavailable" description="Standings load after schedule and result data are available." />
          )}
        </section>

        <section className="ui-card ui-col-4">
          <h3>Injuries</h3>
          {dashboard?.injuries?.length ? (
            <div className="ui-list-stack">
              {dashboard.injuries.map((injury, idx) => (
                <div className="ui-list-item" key={`${injury.playerName}-${idx}`}>
                  {injury.playerName}: {injury.injury} ({injury.expectedReturnWeeks}w)
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Healthy roster" description="No current injuries reported." />
          )}
        </section>

        <section className="ui-card ui-col-4">
          <h3>Inbox News</h3>
          <div className="ui-list-stack">
            <div><strong>Unread:</strong> {dashboard?.inbox?.unread ?? 0}</div>
            {(dashboard?.inbox?.latest ?? []).slice(0, 4).map((item) => (
              <div key={item.id} className="ui-list-item">{item.subject}</div>
            ))}
          </div>
        </section>

        <section className="ui-card ui-col-4">
          <h3>Manager Profile</h3>
          <div className="ui-list-stack">
            <div><strong>Manager:</strong> {currentSave?.data?.manager?.name || 'N/A'}</div>
            <div><strong>Username:</strong> @{currentSave?.data?.manager?.username || 'N/A'}</div>
            <div><strong>Career:</strong> {currentSave?.data?.career?.unemployed ? 'Unemployed' : (careerTeam?.name || careerTeamCode || 'N/A')}</div>
            <div><strong>Teams Loaded:</strong> {teams.length}</div>
          </div>
        </section>
      </div>
    </div>
  );
}



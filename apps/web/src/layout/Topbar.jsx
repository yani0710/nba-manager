import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';

export function Topbar({ title, breadcrumbs, actions = null }) {
  const { currentSave, teams, inbox } = useGameStore();
  const [now, setNow] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const careerTeamCode = currentSave?.data?.career?.teamShortName;
  const team = teams.find((t) => t.shortName === careerTeamCode);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="ui-topbar">
      <div>
        <div className="ui-topbar-breadcrumbs">{breadcrumbs}</div>
        <h2>{title}</h2>
      </div>
      <div className="ui-topbar-right">
        {actions}
        <span className="ui-topbar-pill">{now}</span>
        <span className="ui-topbar-pill">Inbox {inbox?.unread ?? currentSave?.data?.inboxUnread ?? 0}</span>
        <div className="ui-team-chip">
          {team?.logoPath ? <img src={team.logoPath} alt={team.shortName} /> : <span>{careerTeamCode || 'FA'}</span>}
          <span>{team?.shortName || careerTeamCode || 'FA'}</span>
        </div>
      </div>
    </header>
  );
}

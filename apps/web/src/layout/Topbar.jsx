import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import './Topbar.css';

export function Topbar({ title }) {
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
    <header className="topbar">
      <h2>{title}</h2>
      <div className="topbar-meta">
        <span>{currentSave?.data?.currentDate || 'No Date'}</span>
        <span>{now}</span>
        <span>Inbox: {inbox?.unread ?? currentSave?.data?.inboxUnread ?? 0}</span>
        <div className="team-badge">
          {team?.logoPath ? <img src={team.logoPath} alt={team.shortName} /> : <span>{careerTeamCode || 'FA'}</span>}
        </div>
      </div>
    </header>
  );
}

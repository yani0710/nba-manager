import { useRouter } from './app/router';
import { AppShell } from './layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { Prepare } from './pages/Prepare';
import { Inbox } from './pages/Inbox';
import { Squad } from './pages/Squad';
import { Tactics } from './pages/Tactics';
import { TrainingTeam } from './pages/TrainingTeam';
import { TrainingPlayers } from './pages/TrainingPlayers';
import { Schedule } from './pages/Schedule';
import { League } from './pages/League';
import { Teams } from './pages/Teams';
import { Player } from './pages/Player';
import { Transfers } from './pages/Transfers';
import { MatchCenter } from './pages/MatchCenter';
import { Results } from './pages/Results';
import { Matches } from './pages/Matches';
import { SaveLoad } from './pages/SaveLoad';
import { Start } from './pages/Start/index';
import { useGameStore } from './state/gameStore';
import './App.css';
import './styles/ui-shell.css';

function App() {
  const { currentPage } = useRouter();
  const { currentSave } = useGameStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'inbox':
        return <Inbox />;
      case 'prepare':
        return <Prepare />;
      case 'squad':
        return <Squad />;
      case 'tactics':
        return <Tactics />;
      case 'training/team':
        return <TrainingTeam />;
      case 'training/players':
        return <TrainingPlayers />;
      case 'schedule':
        return <Schedule />;
      case 'league':
        return <League />;
      case 'teams':
        return <Teams />;
      case 'players':
        return <Player />;
      case 'transfers':
        return <Transfers />;
      case 'matches':
        return <Matches />;
      case 'match-center':
        return <MatchCenter />;
      case 'results':
        return <Results />;
      case 'saves':
        return <SaveLoad />;
      default:
        return <Dashboard />;
    }
  };

  const getTitleForPage = () => {
    const titles = {
      dashboard: 'Home Dashboard',
      prepare: 'Game Preparation',
      inbox: 'Inbox',
      squad: 'Squad',
      tactics: 'Tactics',
      'training/team': 'Team Training',
      'training/players': 'Player Training',
      schedule: 'Schedule',
      league: 'League Standings',
      teams: 'Teams',
      transfers: 'Transfers',
      players: 'Players',
      matches: 'Matches',
      'match-center': 'Match Center',
      results: 'Results',
      saves: 'Saves',
    };
    return titles[currentPage] || 'NBA Manager';
  };

  if (!currentSave) {
    return <Start onReady={() => { window.location.hash = 'dashboard'; }} />;
  }

  return (
    <AppShell title={getTitleForPage()}>
      {renderPage()}
    </AppShell>
  );
}

export default App;

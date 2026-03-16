import { useEffect, useState } from 'react';

const PAGES = {
  dashboard: 'Home',
  prepare: 'Prepare',
  inbox: 'Inbox',
  squad: 'Squad',
  'training/team': 'Team Training',
  'training/players': 'Player Training',
  tactics: 'Tactics',
  schedule: 'Schedule',
  league: 'League',
  teams: 'Teams',
  transfers: 'Transfers',
  players: 'Players',
  'match-center': 'Match Center',
  results: 'Results',
  matches: 'Matches',
  saves: 'Save Manager',
};

export function useRouter() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    const handleNavigation = (e) => {
      const hashRaw = window.location.hash.slice(1) || 'dashboard';
      const hash = hashRaw.split('?')[0];
      if (PAGES[hash]) {
        setCurrentPage(hash);
      }
    };

    window.addEventListener('hashchange', handleNavigation);
    handleNavigation(); // Set initial page

    return () => window.removeEventListener('hashchange', handleNavigation);
  }, []);

  const navigate = (page) => {
    window.location.hash = page;
  };

  return { currentPage, navigate, pages: PAGES };
}

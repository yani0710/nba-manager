import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../League.css';

const SORT_FIELDS = ['wins', 'losses', 'pct', 'gb', 'streak'];

export function League() {
  const { standings, fetchStandings, loading } = useGameStore();
  const [conference, setConference] = useState('East');
  const [sortBy, setSortBy] = useState('wins');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  const rows = conference === 'East' ? (standings?.east ?? []) : (standings?.west ?? []);
  const sortedRows = useMemo(() => {
    const data = [...rows];
    data.sort((a, b) => {
      const av = a?.[sortBy];
      const bv = b?.[sortBy];
      const base = (typeof av === 'number' && typeof bv === 'number')
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? base : -base;
    });
    return data;
  }, [rows, sortBy, sortDir]);

  const toggleSort = (field) => {
    if (!SORT_FIELDS.includes(field)) return;
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortDir(field === 'losses' || field === 'gb' ? 'asc' : 'desc');
  };

  if (loading) return <div>Loading standings...</div>;

  return (
    <div className="league">
      <h2>NBA Standings</h2>
      <div className="conference-tabs">
        <button className={conference === 'East' ? 'active' : ''} onClick={() => setConference('East')}>East</button>
        <button className={conference === 'West' ? 'active' : ''} onClick={() => setConference('West')}>West</button>
      </div>

      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th onClick={() => toggleSort('wins')}>W</th>
            <th onClick={() => toggleSort('losses')}>L</th>
            <th onClick={() => toggleSort('pct')}>PCT</th>
            <th onClick={() => toggleSort('gb')}>GB</th>
            <th onClick={() => toggleSort('streak')}>STRK</th>
            <th>Division</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => (
            <tr key={row.teamId}>
              <td>{idx + 1}</td>
              <td className="team-name">{row.shortName}</td>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
              <td>{Number(row.pct).toFixed(3)}</td>
              <td>{row.gb === 0 ? '-' : row.gb}</td>
              <td>{row.streak}</td>
              <td>{row.division || '-'}</td>
            </tr>
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={8}>No standings yet. Simulate games to populate records.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

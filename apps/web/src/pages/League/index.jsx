import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonTable } from '../../components/ui';

const SORT_FIELDS = ['wins', 'losses', 'pct', 'gb', 'streak'];

export function League() {
  const { standings, fetchStandings, loading } = useGameStore();
  const [conference, setConference] = useState('East');
  const [sortBy, setSortBy] = useState('wins');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => { fetchStandings(); }, [fetchStandings]);

  const rows = conference === 'East' ? (standings?.east ?? []) : (standings?.west ?? []);
  const sortedRows = useMemo(() => {
    const data = [...rows];
    data.sort((a, b) => {
      const av = a?.[sortBy];
      const bv = b?.[sortBy];
      const base = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? base : -base;
    });
    return data;
  }, [rows, sortBy, sortDir]);

  const toggleSort = (field) => {
    if (!SORT_FIELDS.includes(field)) return;
    if (sortBy === field) return setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setSortBy(field);
    setSortDir(field === 'losses' || field === 'gb' ? 'asc' : 'desc');
  };

  return (
    <div>
      <PageHeader
        title="League Standings"
        subtitle="Sortable conference standings with sticky headers and numeric alignment."
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`ui-btn ${conference === 'East' ? 'ui-btn-primary' : ''}`} onClick={() => setConference('East')}>East</button>
            <button className={`ui-btn ${conference === 'West' ? 'ui-btn-primary' : ''}`} onClick={() => setConference('West')}>West</button>
          </div>
        )}
      />

      {loading ? <SkeletonTable rows={12} cols={8} /> : null}

      {!loading && sortedRows.length === 0 ? (
        <EmptyState title="No standings yet" description="Simulate games to populate records and conference tables." />
      ) : null}

      {!loading && sortedRows.length > 0 ? (
        <div className="ui-card">
          <div className="ui-table-shell">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th className="ui-num" onClick={() => toggleSort('wins')}>W</th>
                  <th className="ui-num" onClick={() => toggleSort('losses')}>L</th>
                  <th className="ui-num" onClick={() => toggleSort('pct')}>PCT</th>
                  <th className="ui-num" onClick={() => toggleSort('gb')}>GB</th>
                  <th className="ui-num" onClick={() => toggleSort('streak')}>STRK</th>
                  <th>Division</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, idx) => (
                  <tr key={row.teamId}>
                    <td>{idx + 1}</td>
                    <td>{row.shortName}</td>
                    <td className="ui-num">{row.wins}</td>
                    <td className="ui-num">{row.losses}</td>
                    <td className="ui-num">{Number(row.pct).toFixed(3)}</td>
                    <td className="ui-num">{row.gb === 0 ? '-' : row.gb}</td>
                    <td className="ui-num">{row.streak}</td>
                    <td>{row.division || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}


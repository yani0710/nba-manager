import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader } from '../../components/ui';
import { formatFixtureDateTime } from '../../domain/fixtures';
import '../Matches.css';

const logoPath = (team) => {
  const short = (team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
};

export function Results() {
  const { currentSave, results, fetchResults, fetchResultDetails } = useGameStore();
  const [selected, setSelected] = useState(null);

  const getMatchIdFromHash = () => {
    const hash = String(window.location.hash || '');
    const [, query = ''] = hash.split('?');
    const params = new URLSearchParams(query);
    const value = params.get('matchId');
    return value ? String(value) : null;
  };

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const openMatch = async (gameId) => {
    window.location.hash = `results?matchId=${gameId}`;
    const details = await fetchResultDetails(gameId);
    setSelected(details);
  };

  useEffect(() => {
    const loadFromHash = async () => {
      const hashGameId = getMatchIdFromHash();
      if (!hashGameId) return;
      if (String(selected?.id || '') === hashGameId) return;
      const details = await fetchResultDetails(hashGameId);
      if (details) setSelected(details);
    };

    loadFromHash();
    window.addEventListener('hashchange', loadFromHash);
    return () => window.removeEventListener('hashchange', loadFromHash);
  }, [fetchResultDetails, selected?.id, results]);

  const renderTeamBoxscore = (team, rows) => (
    <div className="ui-card" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <img
          src={logoPath(team)}
          alt={team?.shortName}
          style={{ width: 24, height: 24 }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <h3 style={{ margin: 0 }}>{team?.shortName || '-'} Boxscore</h3>
      </div>
      <div className="ui-table-shell">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Player</th>
              <th style={{ textAlign: 'right' }}>MIN</th>
              <th style={{ textAlign: 'right' }}>PTS</th>
              <th style={{ textAlign: 'right' }}>2PT</th>
              <th style={{ textAlign: 'right' }}>3PT</th>
              <th style={{ textAlign: 'right' }}>FT</th>
              <th style={{ textAlign: 'right' }}>REB</th>
              <th style={{ textAlign: 'right' }}>AST</th>
              <th style={{ textAlign: 'right' }}>STL</th>
              <th style={{ textAlign: 'right' }}>BLK</th>
              <th style={{ textAlign: 'right' }}>TOV</th>
              <th style={{ textAlign: 'right' }}>PR</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={12} style={{ color: 'var(--ui-text-muted)' }}>No player stats.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.playerId}>
                <td>{p.name}</td>
                <td style={{ textAlign: 'right' }}>{p.minutes ?? 0}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.points ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.twoPtMade ?? 0}/{p.twoPtAtt ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.threePtMade ?? 0}/{p.threePtAtt ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.ftMade ?? 0}/{p.ftAtt ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.rebounds ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.assists ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.steals ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.blocks ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.turnovers ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{p.performanceRating ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (selected) {
    const managedCode = currentSave?.data?.career?.teamShortName;
    const allPlayers = selected.players || [];
    const homeRows = allPlayers
      .filter((p) => p.teamShortName === selected.homeTeam.shortName)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const awayRows = allPlayers
      .filter((p) => p.teamShortName === selected.awayTeam.shortName)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const firstIsManagedHome = managedCode && managedCode === selected.homeTeam.shortName;
    const firstTeam = firstIsManagedHome ? selected.homeTeam : (managedCode === selected.awayTeam.shortName ? selected.awayTeam : selected.homeTeam);
    const secondTeam = firstTeam.shortName === selected.homeTeam.shortName ? selected.awayTeam : selected.homeTeam;
    const firstRows = firstTeam.shortName === selected.homeTeam.shortName ? homeRows : awayRows;
    const secondRows = secondTeam.shortName === selected.homeTeam.shortName ? homeRows : awayRows;

    return (
      <div className="matches-page">
        <PageHeader
          title="Match Center"
          subtitle="Detailed result summary and top performers."
          actions={<button className="ui-btn" onClick={() => { setSelected(null); window.location.hash = 'results'; }}>Back to Results</button>}
        />
        <div className="ui-card" style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8, color: 'var(--ui-text-muted)' }}>{formatFixtureDateTime(selected.gameDate)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={logoPath(selected.homeTeam)} alt={selected.homeTeam.shortName} style={{ width: 28, height: 28 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <strong>{selected.homeTeam.shortName}</strong>
          </div>
          <span style={{ fontSize: 18 }}>{selected.homeScore} - {selected.awayScore}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{selected.awayTeam.shortName}</strong>
            <img src={logoPath(selected.awayTeam)} alt={selected.awayTeam.shortName} style={{ width: 28, height: 28 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        </div>
        <div className="ui-card" style={{ marginBottom: 12 }}>
          <strong>Player of the Match:</strong>
          <span>
            {selected.playerOfTheMatch?.name || '-'} ({selected.playerOfTheMatch?.points || 0} pts, PR {selected.playerOfTheMatch?.performanceRating ?? 0})
          </span>
        </div>
        <div className="ui-card" style={{ marginBottom: 12 }}>
          <strong>Top Scorer:</strong>
          <span>{selected.topScorer?.name || '-'} ({selected.topScorer?.points || 0} pts)</span>
        </div>
        <div className="ui-card">
          <h3>Basic Team Stats</h3>
          <p>{selected.homeTeam.shortName} - PTS {selected.homeScore} | REB {selected.basicStats.home.rebounds} | AST {selected.basicStats.home.assists}</p>
          <p>{selected.awayTeam.shortName} - PTS {selected.awayScore} | REB {selected.basicStats.away.rebounds} | AST {selected.basicStats.away.assists}</p>
          <p>{selected.homeTeam.shortName} - 3PT {selected.basicStats.home.threePtMade}/{selected.basicStats.home.threePtAtt} | FT {selected.basicStats.home.ftMade}/{selected.basicStats.home.ftAtt} | TOV {selected.basicStats.home.turnovers}</p>
          <p>{selected.awayTeam.shortName} - 3PT {selected.basicStats.away.threePtMade}/{selected.basicStats.away.threePtAtt} | FT {selected.basicStats.away.ftMade}/{selected.basicStats.away.ftAtt} | TOV {selected.basicStats.away.turnovers}</p>
        </div>
        {renderTeamBoxscore(firstTeam, firstRows)}
        {renderTeamBoxscore(secondTeam, secondRows)}
      </div>
    );
  }

  return (
    <div className="matches-page">
      <PageHeader title="Results" subtitle="Browse completed games and open a full match center summary." />
      {results.length === 0 && <EmptyState title="No completed matches" description="Advance the schedule to generate final results." />}
      {results.map((game) => (
        <div key={game.id} className="ui-card" style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={logoPath(game.awayTeam)} alt={game.awayTeam.shortName} style={{ width: 22, height: 22 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <strong>{game.awayTeam.shortName}</strong>
          </div>
          <span>{game.awayScore} - {game.homeScore}<br /><small style={{ color: 'var(--ui-text-muted)' }}>{formatFixtureDateTime(game.gameDate)}</small></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong>{game.homeTeam.shortName}</strong>
            <img src={logoPath(game.homeTeam)} alt={game.homeTeam.shortName} style={{ width: 22, height: 22 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <button className="ui-btn" onClick={() => openMatch(game.id)}>Open</button>
        </div>
      ))}
    </div>
  );
}

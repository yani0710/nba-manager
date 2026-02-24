import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { api } from '../../api/client';
import { PlayerCard } from '../../components/domain/PlayerCard';
import '../Player.css';

const PAGE_SIZE = 24;
const display = (value) => (value === null || value === undefined || value === '' ? '--' : value);

function RadarChart({ offensiveRating, playRating, defensiveRating, physicalRating, iqRating }) {
  const values = [
    Number(offensiveRating ?? 60),
    Number(playRating ?? 60),
    Number(defensiveRating ?? 60),
    Number(physicalRating ?? 60),
    Number(iqRating ?? 60),
  ];
  const labels = ['ATT', 'PLAY', 'DEF', 'PHY', 'IQ'];
  const center = 130;
  const radius = 84;
  const points = values.map((v, idx) => {
    const angle = (-Math.PI / 2) + (idx * (Math.PI * 2)) / values.length;
    const r = ((Math.max(60, Math.min(99, v)) - 60) / 39) * radius;
    return `${(center + Math.cos(angle) * r).toFixed(2)},${(center + Math.sin(angle) * r).toFixed(2)}`;
  });

  const axes = labels.map((label, idx) => {
    const angle = (-Math.PI / 2) + (idx * (Math.PI * 2)) / labels.length;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const lx = center + Math.cos(angle) * (radius + 18);
    const ly = center + Math.sin(angle) * (radius + 18);
    return { label, x, y, lx, ly };
  });

  return (
    <svg className="radar-chart" viewBox="0 0 260 260" role="img" aria-label="Player rating radar chart">
      <circle cx={center} cy={center} r={radius} className="radar-ring" />
      <circle cx={center} cy={center} r={radius * 0.66} className="radar-ring" />
      <circle cx={center} cy={center} r={radius * 0.33} className="radar-ring" />
      {axes.map((axis) => (
        <g key={axis.label}>
          <line x1={center} y1={center} x2={axis.x} y2={axis.y} className="radar-axis" />
          <text x={axis.lx} y={axis.ly} className="radar-label" textAnchor="middle">{axis.label}</text>
        </g>
      ))}
      <polygon points={points.join(' ')} className="radar-shape" />
    </svg>
  );
}

function calcAge(birthDate, age) {
  if (typeof age === 'number') return age;
  if (!birthDate) return '--';
  return Math.max(16, new Date().getFullYear() - new Date(birthDate).getFullYear());
}

export function Player() {
  const { players, currentSave, fetchPlayers, loading } = useGameStore();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedPlayerStats, setSelectedPlayerStats] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers, currentSave?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

  const filteredPlayers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return players;
    return players.filter((player) => {
      const name = (player.name || '').toLowerCase();
      const team = (player.team?.shortName || '').toLowerCase();
      const position = (player.position || '').toLowerCase();
      return name.includes(q) || team.includes(q) || position.includes(q);
    });
  }, [players, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedPlayers = filteredPlayers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onOpenProfile = async (player) => {
    setSelectedPlayer(null);
    setSelectedPlayerStats(null);
    try {
      const saveParams = currentSave?.id ? { saveId: currentSave.id } : {};
      const [{ data: fullPlayer }, { data: stats }] = await Promise.all([
        api.players.getById(player.id, saveParams),
        api.players.getStats(player.id, saveParams),
      ]);
      setSelectedPlayer(fullPlayer);
      setSelectedPlayerStats(stats);
    } catch (error) {
      setSelectedPlayer(player);
      setSelectedPlayerStats(null);
    }
  };

  useEffect(() => {
    if (!selectedPlayer?.id || !currentSave?.id) return;
    const refresh = async () => {
      try {
        const [{ data: fullPlayer }, { data: stats }] = await Promise.all([
          api.players.getById(selectedPlayer.id, { saveId: currentSave.id }),
          api.players.getStats(selectedPlayer.id, { saveId: currentSave.id }),
        ]);
        setSelectedPlayer(fullPlayer);
        setSelectedPlayerStats(stats);
      } catch {
        // Keep current view if refresh fails.
      }
    };
    refresh();
  }, [currentSave?.currentDate, currentSave?.updatedAt]);

  if (loading) return <div>Loading player...</div>;

  if (selectedPlayer) {
    return (
      <div className="player-detail-page">
        <button onClick={() => setSelectedPlayer(null)} className="btn-back">
          Back to Players
        </button>

        <div className="player-profile-grid">
          <div className="player-info-card">
            <h2>{selectedPlayer.name}</h2>
            <p><strong>Team:</strong> {display(selectedPlayer.team?.name)}</p>
            <p><strong>Jersey:</strong> {display(selectedPlayer.jerseyNumber ?? selectedPlayer.number)}</p>
            <p><strong>Position:</strong> {display(selectedPlayer.position)}</p>
            <p><strong>Height:</strong> {display(selectedPlayer.heightCm)} cm</p>
            <p><strong>Weight:</strong> {display(selectedPlayer.weightKg)} kg</p>
            <p><strong>Age:</strong> {calcAge(selectedPlayer.birthDate, selectedPlayer.age)}</p>
            <p><strong>Nationality:</strong> {display(selectedPlayer.nationality)}</p>
            <p><strong>Overall Base:</strong> {display(selectedPlayer.overallBase)}</p>
            <p><strong>Overall Current:</strong> {display(selectedPlayer.overallCurrent ?? selectedPlayer.effectiveOverall ?? selectedPlayer.overall)}</p>
            <p><strong>Form:</strong> {display(selectedPlayer.form ?? currentSave?.data?.playerState?.[String(selectedPlayer.id)]?.form)}</p>
            <p><strong>Fatigue:</strong> {display(selectedPlayer.fatigue)}</p>
            <p><strong>Morale:</strong> {display(selectedPlayer.morale)}</p>
            <p><strong>Salary:</strong> {selectedPlayer.salary ? `$${Number(selectedPlayer.salary).toLocaleString()}` : '--'}</p>
            <p><strong>ATT:</strong> {display(selectedPlayer.offensiveRating)}</p>
            <p><strong>PLAY:</strong> {display(selectedPlayer.attributes?.play)}</p>
            <p><strong>DEF:</strong> {display(selectedPlayer.defensiveRating)}</p>
            <p><strong>PHY:</strong> {display(selectedPlayer.physicalRating)}</p>
            <p><strong>IQ:</strong> {display(selectedPlayer.iqRating)}</p>
          </div>

          <div className="player-info-card">
            <h3>Rating Breakdown</h3>
            <RadarChart
              offensiveRating={selectedPlayer.offensiveRating}
              playRating={selectedPlayer.attributes?.play}
              defensiveRating={selectedPlayer.defensiveRating}
              physicalRating={selectedPlayer.physicalRating}
              iqRating={selectedPlayer.iqRating}
            />
            <div style={{ marginTop: 12 }}>
              <p><strong>Strengths:</strong> {(selectedPlayer.scouting?.strengths || []).join(', ') || '--'}</p>
              <p><strong>Weaknesses:</strong> {(selectedPlayer.scouting?.weaknesses || []).join(', ') || '--'}</p>
            </div>
          </div>
        </div>

        <div className="player-info-card" style={{ marginTop: 12 }}>
          <h3>Season Impact Stats</h3>
          {selectedPlayer.seasonImpact?.[0] ? (
            <div className="impact-grid">
              <p><strong>MPG:</strong> {display(selectedPlayer.seasonImpact[0].mpg)}</p>
              <p><strong>PTS:</strong> {display(selectedPlayer.seasonImpact[0].pts)}</p>
              <p><strong>AST:</strong> {display(selectedPlayer.seasonImpact[0].ast)}</p>
              <p><strong>REB:</strong> {display(selectedPlayer.seasonImpact[0].reb)}</p>
              <p><strong>DPM:</strong> {display(selectedPlayer.seasonImpact[0].dpm)}</p>
              <p><strong>DDPM:</strong> {display(selectedPlayer.seasonImpact[0].ddpm)}</p>
              <p><strong>TS%:</strong> {display(selectedPlayer.seasonImpact[0].ts)}</p>
              <p><strong>rTS%:</strong> {display(selectedPlayer.seasonImpact[0].rts)}</p>
            </div>
          ) : (
            <p>No season impact stats imported.</p>
          )}
        </div>

        <div className="player-info-card" style={{ marginTop: 12 }}>
          <h3>Season Statistics</h3>
          {!selectedPlayerStats ? (
            <p>No stats yet.</p>
          ) : (
            <>
              <p><strong>Games:</strong> {selectedPlayerStats.gamesPlayed}</p>
              <p><strong>PPG:</strong> {selectedPlayerStats.averages.points}</p>
              <p><strong>RPG:</strong> {selectedPlayerStats.averages.rebounds}</p>
              <p><strong>APG:</strong> {selectedPlayerStats.averages.assists}</p>
              <h4>Last 5 Games</h4>
              {(selectedPlayerStats.lastFive || []).length === 0 && <p>No games yet.</p>}
              {(selectedPlayerStats.lastFive || []).map((g) => (
                <p key={g.gameId}>
                  {new Date(g.date).toLocaleDateString()} - PTS {g.points} | REB {g.rebounds} | AST {g.assists}
                </p>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="player-detail-page">
      <h2>Players</h2>
      <input
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search player, team, position..."
        className="players-search"
      />

      <div className="player-card-grid">
        {pagedPlayers.map((player) => (
          <PlayerCard key={player.id} player={player} onOpen={onOpenProfile} />
        ))}
      </div>

      <div className="players-pagination">
        <button className="btn-small" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span>Page {safePage} / {totalPages}</span>
        <button className="btn-small" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>
    </div>
  );
}

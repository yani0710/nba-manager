import { useEffect, useMemo, useState } from 'react';
import { EmptyState, SkeletonTable } from '../../components/ui';
import { useGameStore } from '../../state/gameStore';
import { api } from '../../api/client';
import {
  getContractMeta,
  getPlayerSalary,
  getPosTokens,
  normalizeName,
  parseAge,
  parseOverall,
  parsePotential,
  parseStat,
  toMoneyMillions,
} from './rosterUtils';
import './squad.css';

function normalizePct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1) return n * 100;
  return n;
}

function getMoodEmoji(morale) {
  if (morale >= 90) return '😁';
  if (morale >= 75) return '🙂';
  if (morale >= 60) return '😐';
  return '😟';
}

function getOvrTierClass(ovr) {
  if (ovr >= 90) return 'elite';
  if (ovr >= 84) return 'great';
  if (ovr >= 78) return 'good';
  return 'solid';
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function toPlayerVm({ player, season, startersSet, injuriesByName }) {
  const overall = parseOverall(player);
  const potential = parsePotential(player);
  const age = parseAge(player);
  const salary = getPlayerSalary(player);
  const contractMeta = getContractMeta(player, season);
  const lowerName = normalizeName(player.name);
  const injury = injuriesByName.get(lowerName);
  const injuryStatus = injury ? `Out (${Number(injury.expectedReturnWeeks ?? 1)}w)` : 'Active';
  const morale = Number(player.morale ?? 72);
  const fitness = Math.max(0, 100 - Number(player.fatigue ?? 8));
  const shooting = Math.round((Number(player?.offensiveRating ?? 60) + Number(player?.attributes?.att ?? 60)) / 2);
  const defense = Number(player?.defensiveRating ?? 60);
  const passing = Number(player?.attributes?.play ?? 60);
  const dribbling = Math.round((passing + Number(player?.attributes?.att ?? 60)) / 2);
  const athleticism = Math.round((fitness + Number(player?.attributes?.stam ?? 70)) / 2);
  const iq = Math.round((overall + potential) / 2);
  const fgPct = normalizePct(player?.fgCareer ?? player?.fgPct ?? player?.fieldGoalPct ?? 0);

  return {
    ...player,
    jersey: player.jerseyCode ?? player.jerseyNumber ?? player.number ?? '-',
    overall,
    potential,
    age,
    salary,
    contractYears: contractMeta.yearsRemaining,
    injuryStatus,
    ppg: parseStat(player.ptsCareer),
    rpg: parseStat(player.trbCareer),
    apg: parseStat(player.astCareer),
    fgPct,
    morale,
    mood: getMoodEmoji(morale),
    fitness,
    shooting,
    defense,
    passing,
    dribbling,
    athleticism,
    iq,
    isStarter: startersSet.has(player.id),
  };
}

function AttributeBar({ label, value }) {
  const safe = Math.max(0, Math.min(99, Number(value) || 0));
  return (
    <div className="sq-attr-row">
      <div className="sq-attr-head">
        <span>{label}</span>
        <strong>{safe}</strong>
      </div>
      <div className="sq-attr-track">
        <span style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

export function Squad() {
  const {
    currentSave,
    dashboard,
    squadPlayers,
    fetchSquad,
    fetchDashboard,
    loading,
  } = useGameStore();

  const [activePos, setActivePos] = useState('ALL');
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedPlayerStats, setSelectedPlayerStats] = useState(null);

  const teamShortName = currentSave?.data?.career?.teamShortName ?? currentSave?.team?.shortName ?? null;
  const season = currentSave?.season ?? '2025-26';
  const teamName = currentSave?.team?.name || teamShortName || 'Team';
  const injuries = currentSave?.data?.injuries ?? [];

  useEffect(() => {
    if (!teamShortName) return;
    fetchSquad();
    fetchDashboard();
  }, [fetchSquad, fetchDashboard, currentSave?.id, teamShortName]);

  const startersSet = useMemo(() => {
    const slots = currentSave?.data?.rotation ?? {};
    return new Set(Object.values(slots).map((id) => Number(id)).filter(Number.isFinite));
  }, [currentSave?.data?.rotation]);

  const injuriesByName = useMemo(() => {
    const map = new Map();
    for (const injury of injuries) map.set(normalizeName(injury.playerName), injury);
    return map;
  }, [injuries]);

  const managedRoster = useMemo(
    () => (Array.isArray(squadPlayers) ? squadPlayers : [])
      .map((player) => toPlayerVm({
        player,
        season,
        startersSet,
        injuriesByName,
      }))
      .sort((a, b) => b.overall - a.overall),
    [squadPlayers, season, startersSet, injuriesByName],
  );

  const shownPlayers = useMemo(() => {
    if (activePos === 'ALL') return managedRoster;
    return managedRoster.filter((player) => getPosTokens(player.position).includes(activePos));
  }, [managedRoster, activePos]);

  const selectedPlayer = useMemo(
    () => managedRoster.find((player) => player.id === selectedPlayerId) ?? null,
    [managedRoster, selectedPlayerId],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedPlayerId || !currentSave?.id) {
        setSelectedPlayerStats(null);
        return;
      }
      try {
        const { data } = await api.players.getStats(selectedPlayerId, { saveId: currentSave.id });
        if (!cancelled) setSelectedPlayerStats(data);
      } catch {
        if (!cancelled) setSelectedPlayerStats(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedPlayerId, currentSave?.id, currentSave?.currentDate]);

  if (!teamShortName) {
    return <EmptyState title="No managed team" description="Start or load a career with a team to view your squad." />;
  }

  if (loading && (!squadPlayers || squadPlayers.length === 0)) {
    return <SkeletonTable rows={10} cols={10} />;
  }

  return (
    <div className="squad-premium">
      <nav className="sq-pos-tabs">
        {['ALL', 'PG', 'SG', 'SF', 'PF', 'C'].map((pos) => (
          <button
            key={pos}
            type="button"
            className={activePos === pos ? 'is-active' : ''}
            onClick={() => setActivePos(pos)}
          >
            {pos}
          </button>
        ))}
      </nav>

      <header className="sq-header">
        <h1>Squad Roster</h1>
        <p>{teamName} ({teamShortName}) | Record {dashboard?.overview?.wins ?? 0}-{dashboard?.overview?.losses ?? 0}</p>
        <small>Showing {shownPlayers.length} of {managedRoster.length} players</small>
      </header>

      <section className="sq-table-shell">
        <table className="sq-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Age</th>
              <th>OVR</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>FG%</th>
              <th>Status</th>
              <th>Mood</th>
              <th>Contract</th>
            </tr>
          </thead>
          <tbody>
            {shownPlayers.map((player) => (
              <tr key={player.id} onClick={() => { setSelectedPlayerId(player.id); setSelectedPlayerStats(null); }}>
                <td>{player.jersey}</td>
                <td>
                  <div className="sq-player-cell">
                    <span className="sq-avatar">{initials(player.name)}</span>
                    <div>
                      <strong>{player.name}</strong>
                      <small>{player.nationality || 'N/A'}</small>
                    </div>
                  </div>
                </td>
                <td>{player.position || '-'}</td>
                <td>{player.age ?? '--'}</td>
                <td>
                  <span className={`sq-ovr ${getOvrTierClass(player.overall)}`}>{player.overall}</span>
                  <small className="sq-pot">↗ {player.potential}</small>
                </td>
                <td>{player.ppg.toFixed(1)}</td>
                <td>{player.rpg.toFixed(1)}</td>
                <td>{player.apg.toFixed(1)}</td>
                <td>{player.fgPct.toFixed(1)}%</td>
                <td>{player.injuryStatus}</td>
                <td>{player.mood}</td>
                <td>{toMoneyMillions(player.salary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedPlayer ? (
        <div className="sq-modal-backdrop" onClick={() => setSelectedPlayerId(null)} role="presentation">
          <section className="sq-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button type="button" className="sq-close" onClick={() => setSelectedPlayerId(null)}>×</button>

            <div className="sq-modal-head">
              <span className="sq-avatar large">{initials(selectedPlayer.name)}</span>
              <div>
                <h2>{selectedPlayer.name}</h2>
                <p>#{selectedPlayer.jersey} • <strong>{selectedPlayer.position}</strong> • {selectedPlayer.age} years old</p>
              </div>
            </div>

            <div className="sq-modal-grid">
              <article>
                <h3>Season Statistics</h3>
                <div className="sq-stat-list">
                  <p><span>Points Per Game</span><strong>{Number(selectedPlayerStats?.averages?.points ?? selectedPlayer.ppg).toFixed(1)}</strong></p>
                  <p><span>Rebounds</span><strong>{Number(selectedPlayerStats?.averages?.rebounds ?? selectedPlayer.rpg).toFixed(1)}</strong></p>
                  <p><span>Assists</span><strong>{Number(selectedPlayerStats?.averages?.assists ?? selectedPlayer.apg).toFixed(1)}</strong></p>
                  <p><span>Minutes Per Game</span><strong>{Number(selectedPlayerStats?.averages?.minutes ?? 0).toFixed(1)}</strong></p>
                  <p><span>FG%</span><strong>{Number(selectedPlayerStats?.averages?.fgPct ?? selectedPlayer.fgPct).toFixed(1)}%</strong></p>
                </div>
              </article>

              <article>
                <h3>Attributes</h3>
                <AttributeBar label="Shooting" value={selectedPlayer.shooting} />
                <AttributeBar label="Defense" value={selectedPlayer.defense} />
                <AttributeBar label="Passing" value={selectedPlayer.passing} />
                <AttributeBar label="Dribbling" value={selectedPlayer.dribbling} />
                <AttributeBar label="Athleticism" value={selectedPlayer.athleticism} />
                <AttributeBar label="IQ" value={selectedPlayer.iq} />
              </article>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

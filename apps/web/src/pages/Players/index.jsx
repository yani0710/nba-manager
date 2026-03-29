import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { api } from '../../api/client';
import { EmptyState, PageHeader } from '../../components/ui';
import './players.css';

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '$0.0M';
  return `$${(n / 1_000_000).toFixed(1)}M`;
}

function playerCardTone(player) {
  const p = String(player?.position || '').toUpperCase();
  if (p.includes('PG')) return 'is-blue';
  if (p.includes('SG')) return 'is-purple';
  if (p.includes('SF')) return 'is-red';
  if (p.includes('PF')) return 'is-cyan';
  return 'is-gold';
}

export function Players() {
  const { players, currentSave, fetchPlayers, loading } = useGameStore();
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('All');
  const [sortBy, setSortBy] = useState('overall');
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState(null);
  const [selectedStats, setSelectedStats] = useState(null);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers, currentSave?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = (players || []).filter((p) => {
      const byName = !q || String(p.name || '').toLowerCase().includes(q);
      const byPos = position === 'All' || String(p.position || '').toUpperCase().includes(position);
      return byName && byPos;
    });
    out.sort((a, b) => {
      if (sortBy === 'age') return num(a.age, 25) - num(b.age, 25);
      if (sortBy === 'salary') return num(b.salary, 0) - num(a.salary, 0);
      if (sortBy === 'potential') return num(b.potential, 70) - num(a.potential, 70);
      return num(b.overallCurrent ?? b.overall, 65) - num(a.overallCurrent ?? a.overall, 65);
    });
    return out;
  }, [players, position, search, sortBy]);

  const openPlayer = async (player) => {
    setSelected(player);
    setSelectedStats(null);
    try {
      const saveParams = currentSave?.id ? { saveId: currentSave.id } : {};
      const [{ data: fullPlayer }, { data: stats }] = await Promise.all([
        api.players.getById(player.id, saveParams),
        api.players.getStats(player.id, saveParams),
      ]);
      setSelected(fullPlayer);
      setSelectedStats(stats);
    } catch {
      // fallback to card data
    }
  };

  return (
    <div className="pldb-page">
      <PageHeader title="Player Database" subtitle="Comprehensive stats and ratings for all NBA players" />

      <section className="pldb-toolbar-card">
        <div className="pldb-toolbar-row">
          <div className="pldb-search-wrap">
            <span>🔎</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players by name..." />
          </div>

          <div className="pldb-pos-tabs">
            {POSITIONS.map((p) => (
              <button key={p} type="button" className={position === p ? 'is-active' : ''} onClick={() => setPosition(p)}>{p}</button>
            ))}
          </div>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="overall">Overall</option>
            <option value="potential">Potential</option>
            <option value="salary">Market Value</option>
            <option value="age">Age</option>
          </select>

          <div className="pldb-view-tabs">
            {['grid', 'list', 'detailed'].map((v) => (
              <button key={v} type="button" className={view === v ? 'is-active' : ''} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
        </div>
        <small>Showing {filtered.length} of {(players || []).length} players</small>
      </section>

      {loading ? <div className="pldb-empty">Loading players...</div> : null}
      {!loading && filtered.length === 0 ? <EmptyState title="No players found" description="Try another filter or search." /> : null}

      {!loading && filtered.length > 0 ? (
        <section className={view === 'grid' ? 'pldb-grid' : 'pldb-grid pldb-grid-list'}>
          {filtered.map((p) => {
            const ovr = num(p.overallCurrent ?? p.overall, 65);
            const pot = num(p.potential, ovr + 2);
            return (
              <button key={p.id} type="button" className={`pldb-card ${playerCardTone(p)}`} onClick={() => openPlayer(p)}>
                <div className="pldb-card-top">
                  <span className="pldb-pot">↗ {pot}</span>
                  <span className="pldb-ovr">{ovr}</span>
                </div>
                <div className="pldb-avatar">{initials(p.name)}</div>
                <div className="pldb-card-body">
                  <strong>{p.name}</strong>
                  <small>{p.position || '-'} • #{p.jerseyCode ?? p.jerseyNumber ?? p.number ?? '--'} • {p.team?.shortName || 'FA'}</small>
                  <div className="pldb-mini-stats">
                    <span>PPG <b>{num(p.ptsCareer, 0).toFixed(1)}</b></span>
                    <span>RPG <b>{num(p.trbCareer, 0).toFixed(1)}</b></span>
                    <span>APG <b>{num(p.astCareer, 0).toFixed(1)}</b></span>
                  </div>
                  <div className="pldb-value-row"><span>Market Value</span><b>{money(p.salary)}</b></div>
                </div>
              </button>
            );
          })}
        </section>
      ) : null}

      {selected ? (
        <div className="pldb-modal-backdrop" onClick={() => setSelected(null)}>
          <article className="pldb-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="pldb-close" onClick={() => setSelected(null)}>×</button>

            <header className={`pldb-modal-head ${playerCardTone(selected)}`}>
              <div className="pldb-modal-id">{initials(selected.name)}</div>
              <div className="pldb-modal-main">
                <h2>{selected.name}</h2>
                <p>{selected.position || '-'} • #{selected.jerseyCode ?? selected.jerseyNumber ?? selected.number ?? '--'} • {num(selected.age, 25)} years old • {selected.nationality || 'N/A'} • {selected.team?.name || 'Free Agent'}</p>
                <div className="pldb-kpi-row">
                  <div><span>Potential</span><b>{num(selected.potential, 70)}</b></div>
                  <div><span>Market Value</span><b>{money(selected.salary)}</b></div>
                  <div><span>Annual Wage</span><b>{money(selected.salary)}</b></div>
                  <div><span>Morale</span><b>{num(selected.morale, 70) >= 75 ? 'Excellent' : num(selected.morale, 70) >= 60 ? 'Good' : 'Average'}</b></div>
                </div>
              </div>
              <div className="pldb-modal-ovr">{num(selected.overallCurrent ?? selected.overall, 65)}</div>
            </header>

            <div className="pldb-modal-grid">
              <section className="pldb-panel">
                <h3>2025-26 Season Statistics</h3>
                <div className="pldb-stat-grid">
                  <div><span>Games Played</span><b>{num(selectedStats?.gamesPlayed, 0)}</b></div>
                  <div><span>Minutes/Game</span><b>{num(selectedStats?.averages?.minutes, 0).toFixed(1)}</b></div>
                  <div><span>Points</span><b>{num(selectedStats?.averages?.points, num(selected.ptsCareer, 0)).toFixed(1)}</b></div>
                  <div><span>Rebounds</span><b>{num(selectedStats?.averages?.rebounds, num(selected.trbCareer, 0)).toFixed(1)}</b></div>
                  <div><span>Assists</span><b>{num(selectedStats?.averages?.assists, num(selected.astCareer, 0)).toFixed(1)}</b></div>
                  <div><span>FG%</span><b>{num(selectedStats?.averages?.fgPct, num(selected.fgCareer, 0)).toFixed(1)}%</b></div>
                </div>
              </section>

              <section className="pldb-panel">
                <h3>Contract Details</h3>
                <div className="pldb-lines">
                  <div><span>Current Team</span><b>{selected.team?.name || 'Free Agent'}</b></div>
                  <div><span>Annual Salary</span><b>{money(selected.salary)}</b></div>
                  <div><span>Contract Length</span><b>{Math.max(1, num(selected.contractYears, 2))} years</b></div>
                  <div><span>Morale</span><b>{num(selected.morale, 70) >= 75 ? 'Excellent' : num(selected.morale, 70) >= 60 ? 'Good' : 'Average'}</b></div>
                </div>
              </section>

              <section className="pldb-panel">
                <h3>Player Attributes</h3>
                <div className="pldb-attrs">
                  {[
                    ['Shooting', num(selected.offensiveRating, 70)],
                    ['Defense', num(selected.defensiveRating, 70)],
                    ['Passing', num(selected.attributes?.play, 70)],
                    ['Dribbling', num(selected.attributes?.att, 70)],
                    ['Athleticism', num(selected.physicalRating, 70)],
                    ['BBIQ', num(selected.iqRating, 70)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div><span>{label}</span><b>{value}</b></div>
                      <i><i style={{ width: `${clamp(value, 0, 99)}%` }} /></i>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pldb-panel">
                <h3>Career Highlights</h3>
                <div className="pldb-note-list">
                  <article><b>All-Star Selection</b><small>Selected {Math.max(0, Math.round(num(selected.overallCurrent ?? selected.overall, 70) / 20))} times</small></article>
                  <article><b>Career PPG</b><small>{num(selected.ptsCareer, 0).toFixed(1)} points per game</small></article>
                  <article><b>Player Development</b><small>{num(selected.potential, 70) - num(selected.overallCurrent ?? selected.overall, 70) >= 4 ? 'High growth potential' : 'Near prime level'}</small></article>
                </div>
              </section>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

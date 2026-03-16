import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { formatFixtureDate } from '../../domain/fixtures';
import './prepare.css';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

const FORMATIONS = {
  traditional: {
    label: '1-2-2 Traditional',
    board: {
      PG: { x: 0.5, y: 0.72 },
      SG: { x: 0.3, y: 0.57 },
      SF: { x: 0.7, y: 0.57 },
      PF: { x: 0.36, y: 0.36 },
      C: { x: 0.64, y: 0.36 },
    },
  },
  spread: {
    label: '1-3-1 Spread',
    board: {
      PG: { x: 0.5, y: 0.74 },
      SG: { x: 0.24, y: 0.56 },
      SF: { x: 0.5, y: 0.52 },
      PF: { x: 0.76, y: 0.56 },
      C: { x: 0.5, y: 0.34 },
    },
  },
  balanced: {
    label: '2-1-2 Balanced',
    board: {
      PG: { x: 0.4, y: 0.7 },
      SG: { x: 0.6, y: 0.7 },
      SF: { x: 0.5, y: 0.55 },
      PF: { x: 0.36, y: 0.37 },
      C: { x: 0.64, y: 0.37 },
    },
  },
};

function detectFormation(board) {
  const b = board || {};
  if (Math.abs((b.SF?.x ?? 0.5) - 0.5) < 0.04) return 'spread';
  if (Math.abs((b.PG?.x ?? 0.5) - 0.5) < 0.04 && Math.abs((b.SG?.x ?? 0.3) - 0.3) < 0.06) return 'traditional';
  return 'balanced';
}

function parseGameIdFromHash() {
  const raw = window.location.hash || '';
  const idx = raw.indexOf('?');
  if (idx < 0) return null;
  const qs = new URLSearchParams(raw.slice(idx + 1));
  const value = Number(qs.get('gameId'));
  return Number.isFinite(value) ? value : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function Prepare() {
  const { currentSave, scheduleGames, squadPlayers, fetchSchedule, fetchSquad, saveTactics } = useGameStore();
  const [selectedGameId, setSelectedGameId] = useState(parseGameIdFromHash());
  const [formation, setFormation] = useState('traditional');
  const [rotation, setRotation] = useState({ PG: null, SG: null, SF: null, PF: null, C: null });
  const [pace, setPace] = useState(50);
  const [defensePriority, setDefensePriority] = useState(50);
  const [threePointEmphasis, setThreePointEmphasis] = useState(50);
  const [instructions, setInstructions] = useState({
    fastBreak: true,
    pressAfterMade: true,
    isoStars: false,
    crashBoards: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedule();
    fetchSquad();
  }, [fetchSchedule, fetchSquad]);

  useEffect(() => {
    const fromSave = currentSave?.data?.rotation || {};
    const savedTactics = currentSave?.data?.tactics || {};
    setRotation({
      PG: fromSave.PG ?? null,
      SG: fromSave.SG ?? null,
      SF: fromSave.SF ?? null,
      PF: fromSave.PF ?? null,
      C: fromSave.C ?? null,
    });
    const paceValue = savedTactics?.pace === 'fast' ? 80 : savedTactics?.pace === 'slow' ? 25 : 50;
    setPace(paceValue);
    setThreePointEmphasis(Number(savedTactics?.threePtFocus ?? 50));
    setDefensePriority(savedTactics?.defenseScheme === 'press' ? 80 : savedTactics?.defenseScheme === 'drop' ? 25 : 50);
    setInstructions({
      fastBreak: savedTactics?.instructions?.fastBreak ?? true,
      pressAfterMade: savedTactics?.instructions?.pressAfterMade ?? true,
      isoStars: savedTactics?.instructions?.isoStars ?? false,
      crashBoards: savedTactics?.instructions?.crashBoards ?? true,
    });
    setFormation(detectFormation(savedTactics?.board || FORMATIONS.traditional.board));
  }, [currentSave?.id, currentSave?.data?.rotation, currentSave?.data?.tactics]);

  const upcomingFixtures = useMemo(
    () => (scheduleGames || [])
      .filter((g) => (g.status || '').toLowerCase() === 'scheduled')
      .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate)),
    [scheduleGames],
  );

  useEffect(() => {
    if (!upcomingFixtures.length) return;
    if (selectedGameId && upcomingFixtures.some((g) => g.id === selectedGameId)) return;
    setSelectedGameId(upcomingFixtures[0].id);
  }, [upcomingFixtures, selectedGameId]);

  const selectedGame = upcomingFixtures.find((g) => g.id === selectedGameId) || null;
  const board = FORMATIONS[formation]?.board || FORMATIONS.traditional.board;

  const playersByPosition = useMemo(() => {
    const byPos = { PG: [], SG: [], SF: [], PF: [], C: [] };
    const all = squadPlayers || [];
    for (const player of all) {
      const pos = String(player.position || '').toUpperCase();
      for (const slot of POSITION_ORDER) {
        if (pos.includes(slot)) byPos[slot].push(player);
      }
    }
    for (const slot of POSITION_ORDER) {
      byPos[slot].sort((a, b) => (b.overallCurrent ?? b.overall ?? 0) - (a.overallCurrent ?? a.overall ?? 0));
      if (byPos[slot].length === 0) byPos[slot] = all;
    }
    return byPos;
  }, [squadPlayers]);

  const playerMap = useMemo(() => new Map((squadPlayers || []).map((p) => [p.id, p])), [squadPlayers]);

  const goto = (page) => {
    window.location.hash = `${page}`;
  };

  const toggleInstruction = (key) => {
    setInstructions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const savePrepare = async () => {
    setSaving(true);
    try {
      const defenseScheme = defensePriority <= 33 ? 'drop' : defensePriority >= 67 ? 'press' : 'switch';
      const paceMode = pace <= 33 ? 'slow' : pace >= 67 ? 'fast' : 'balanced';
      const boardWithPlayers = {
        PG: { ...board.PG, playerId: rotation.PG ?? null },
        SG: { ...board.SG, playerId: rotation.SG ?? null },
        SF: { ...board.SF, playerId: rotation.SF ?? null },
        PF: { ...board.PF, playerId: rotation.PF ?? null },
        C: { ...board.C, playerId: rotation.C ?? null },
      };
      await saveTactics({
        pace: paceMode,
        threePtFocus: clamp(threePointEmphasis, 0, 100),
        defenseScheme,
        instructions,
        board: boardWithPlayers,
      }, rotation);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="prepare-page">
      <div className="prepare-top">
        <div>
          <h1>Game Preparation</h1>
          <p>Set formation, lineup, tactics, and training before your next matchup.</p>
        </div>
        <div className="prepare-quick-tabs">
          <button className="prepare-quick-btn" type="button" onClick={() => goto('tactics')}>Tactics</button>
          <button className="prepare-quick-btn" type="button" onClick={() => goto('training/team')}>Team Training</button>
          <button className="prepare-quick-btn" type="button" onClick={() => goto('training/players')}>Player Training</button>
          <button className="prepare-quick-btn" type="button" onClick={() => goto('match-center')}>Match Center</button>
        </div>
      </div>

      <section className="prepare-card">
        <h3>Next Fixtures</h3>
        <div className="prepare-fixtures-row">
          {upcomingFixtures.slice(0, 5).map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              className={`prepare-fixture-pill ${fixture.id === selectedGameId ? 'is-active' : ''}`}
              onClick={() => setSelectedGameId(fixture.id)}
            >
              {fixture.awayTeam.shortName} @ {fixture.homeTeam.shortName} | {formatFixtureDate(fixture.gameDate)}
            </button>
          ))}
        </div>
        {selectedGame ? (
          <div className="prepare-fixture-selected">
            Preparing for: {selectedGame.awayTeam.shortName} at {selectedGame.homeTeam.shortName} ({formatFixtureDate(selectedGame.gameDate)})
          </div>
        ) : null}
      </section>

      <div className="prepare-grid">
        <section className="prepare-card prepare-card-main">
          <div className="prepare-card-header">
            <h3>Formation</h3>
            <select className="prepare-select" value={formation} onChange={(e) => setFormation(e.target.value)}>
              <option value="traditional">1-2-2 Traditional</option>
              <option value="spread">1-3-1 Spread</option>
              <option value="balanced">2-1-2 Balanced</option>
            </select>
          </div>

          <div className="prepare-court">
            <div className="prepare-court-halfline" />
            <div className="prepare-court-center-circle" />
            <div className="prepare-court-paint" />
            <div className="prepare-court-rim-circle" />
            {POSITION_ORDER.map((pos) => {
              const slot = board[pos];
              const player = playerMap.get(rotation[pos]);
              const token = player?.jerseyNumber ?? player?.number ?? pos;
              return (
                <div
                  key={pos}
                  className="prepare-token"
                  style={{ left: `${(slot.x || 0.5) * 100}%`, top: `${(slot.y || 0.5) * 100}%` }}
                  title={`${pos}${player ? ` - ${player.name}` : ''}`}
                >
                  {token}
                </div>
              );
            })}
          </div>

          <div className="prepare-save-row">
            <button className="prepare-primary-btn" type="button" onClick={savePrepare} disabled={saving}>
              {saving ? 'Saving...' : 'Save Tactics'}
            </button>
          </div>
        </section>

        <aside className="prepare-side">
          <section className="prepare-card">
            <h3>Starting Five</h3>
            <div className="prepare-form">
              {POSITION_ORDER.map((slot) => (
                <label className="prepare-form-row" key={slot}>
                  <span>{slot}</span>
                  <select
                    className="prepare-select"
                    value={rotation[slot] ?? ''}
                    onChange={(e) => setRotation((prev) => ({ ...prev, [slot]: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">Unassigned</option>
                    {(playersByPosition[slot] || []).map((player) => (
                      <option value={player.id} key={`${slot}-${player.id}`}>
                        {player.name} ({player.overallCurrent ?? player.overall ?? 0})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="prepare-card">
            <h3>Playing Style</h3>
            <div className="prepare-slider-row">
              <div className="prepare-slider-label"><span>Pace</span><strong>{pace}%</strong></div>
              <input type="range" min="0" max="100" value={pace} onChange={(e) => setPace(Number(e.target.value))} />
            </div>
            <div className="prepare-slider-row">
              <div className="prepare-slider-label"><span>Defense Priority</span><strong>{defensePriority}%</strong></div>
              <input type="range" min="0" max="100" value={defensePriority} onChange={(e) => setDefensePriority(Number(e.target.value))} />
            </div>
            <div className="prepare-slider-row">
              <div className="prepare-slider-label"><span>3-Point Emphasis</span><strong>{threePointEmphasis}%</strong></div>
              <input type="range" min="0" max="100" value={threePointEmphasis} onChange={(e) => setThreePointEmphasis(Number(e.target.value))} />
            </div>
          </section>

          <section className="prepare-card">
            <h3>Team Instructions</h3>
            <label className="prepare-check"><input type="checkbox" checked={instructions.fastBreak} onChange={() => toggleInstruction('fastBreak')} /> Fast break opportunities</label>
            <label className="prepare-check"><input type="checkbox" checked={instructions.pressAfterMade} onChange={() => toggleInstruction('pressAfterMade')} /> Press after made baskets</label>
            <label className="prepare-check"><input type="checkbox" checked={instructions.isoStars} onChange={() => toggleInstruction('isoStars')} /> ISO plays for star players</label>
            <label className="prepare-check"><input type="checkbox" checked={instructions.crashBoards} onChange={() => toggleInstruction('crashBoards')} /> Crash offensive boards</label>
          </section>
        </aside>
      </div>
    </div>
  );
}

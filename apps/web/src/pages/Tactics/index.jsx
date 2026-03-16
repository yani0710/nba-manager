import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { CourtBoard, DEFAULT_TACTICS_BOARD } from '../../components/domain/CourtBoard';
import { PageHeader } from '../../components/ui';
import './tactics.css';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

const FORMATIONS = {
  traditional: {
    label: '1-2-2 Traditional',
    board: {
      PG: { x: 0.5, y: 0.74, playerId: null },
      SG: { x: 0.3, y: 0.58, playerId: null },
      SF: { x: 0.7, y: 0.58, playerId: null },
      PF: { x: 0.36, y: 0.36, playerId: null },
      C: { x: 0.64, y: 0.36, playerId: null },
    },
  },
  spread: {
    label: '1-3-1 Spread',
    board: {
      PG: { x: 0.5, y: 0.78, playerId: null },
      SG: { x: 0.22, y: 0.58, playerId: null },
      SF: { x: 0.5, y: 0.54, playerId: null },
      PF: { x: 0.78, y: 0.58, playerId: null },
      C: { x: 0.5, y: 0.34, playerId: null },
    },
  },
  balanced: {
    label: '2-1-2 Balanced',
    board: {
      PG: { x: 0.42, y: 0.72, playerId: null },
      SG: { x: 0.58, y: 0.72, playerId: null },
      SF: { x: 0.5, y: 0.56, playerId: null },
      PF: { x: 0.38, y: 0.36, playerId: null },
      C: { x: 0.62, y: 0.36, playerId: null },
    },
  },
};

function clamp01(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function detectFormation(board) {
  const b = board || {};
  if (Math.abs((b.SF?.x ?? 0.5) - 0.5) < 0.04) return 'spread';
  if (Math.abs((b.PG?.x ?? 0.5) - 0.5) < 0.04 && Math.abs((b.SG?.x ?? 0.3) - 0.3) < 0.06) return 'traditional';
  return 'balanced';
}

export function Tactics() {
  const { currentSave, squadPlayers, fetchSquad, saveTactics } = useGameStore();
  const [activeTab, setActiveTab] = useState('attack');
  const [boardMode, setBoardMode] = useState('attack');
  const [saving, setSaving] = useState(false);
  const [formation, setFormation] = useState('traditional');
  const [rotation, setRotation] = useState({ PG: null, SG: null, SF: null, PF: null, C: null });
  const [tactics, setTactics] = useState({
    pace: 'balanced',
    threePtFocus: 50,
    defenseScheme: 'switch',
    offenseStyle: 'balanced',
    defenseMode: 'man',
    instructions: {
      fastBreak: true,
      pressAfterMade: false,
      isoStars: false,
      crashBoards: true,
    },
    board: DEFAULT_TACTICS_BOARD,
  });

  useEffect(() => { fetchSquad(); }, [fetchSquad]);

  useEffect(() => {
    const payload = currentSave?.data || {};
    const storedBoard = { ...DEFAULT_TACTICS_BOARD, ...(payload?.tactics?.board || {}) };
    const boards = payload?.tactics?.boards || {};
    setTactics({
      pace: payload?.tactics?.pace || 'balanced',
      threePtFocus: clamp01(payload?.tactics?.threePtFocus ?? 50),
      defenseScheme: payload?.tactics?.defenseScheme || 'switch',
      offenseStyle: payload?.tactics?.offenseStyle || 'balanced',
      defenseMode: payload?.tactics?.defenseMode || 'man',
      instructions: {
        fastBreak: payload?.tactics?.instructions?.fastBreak ?? true,
        pressAfterMade: payload?.tactics?.instructions?.pressAfterMade ?? false,
        isoStars: payload?.tactics?.instructions?.isoStars ?? false,
        crashBoards: payload?.tactics?.instructions?.crashBoards ?? true,
      },
      board: storedBoard,
      boards: {
        attack: { ...DEFAULT_TACTICS_BOARD, ...(boards.attack || storedBoard) },
        transition: { ...DEFAULT_TACTICS_BOARD, ...(boards.transition || storedBoard) },
        defense: { ...DEFAULT_TACTICS_BOARD, ...(boards.defense || storedBoard) },
      },
    });
    setRotation({
      PG: payload?.rotation?.PG ?? null,
      SG: payload?.rotation?.SG ?? null,
      SF: payload?.rotation?.SF ?? null,
      PF: payload?.rotation?.PF ?? null,
      C: payload?.rotation?.C ?? null,
    });
    setFormation(detectFormation(boards.attack || storedBoard));
  }, [currentSave]);

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

  const applyFormation = (formationKey) => {
    const base = FORMATIONS[formationKey]?.board || FORMATIONS.traditional.board;
    setFormation(formationKey);
    setTactics((prev) => ({
      ...prev,
      boards: {
        ...(prev.boards || {}),
        [boardMode]: {
          ...(prev.boards?.[boardMode] || {}),
          PG: { ...base.PG, playerId: prev.boards?.[boardMode]?.PG?.playerId ?? rotation.PG ?? null },
          SG: { ...base.SG, playerId: prev.boards?.[boardMode]?.SG?.playerId ?? rotation.SG ?? null },
          SF: { ...base.SF, playerId: prev.boards?.[boardMode]?.SF?.playerId ?? rotation.SF ?? null },
          PF: { ...base.PF, playerId: prev.boards?.[boardMode]?.PF?.playerId ?? rotation.PF ?? null },
          C: { ...base.C, playerId: prev.boards?.[boardMode]?.C?.playerId ?? rotation.C ?? null },
        },
      },
      board: {
        PG: { ...base.PG, playerId: prev.board?.PG?.playerId ?? rotation.PG ?? null },
        SG: { ...base.SG, playerId: prev.board?.SG?.playerId ?? rotation.SG ?? null },
        SF: { ...base.SF, playerId: prev.board?.SF?.playerId ?? rotation.SF ?? null },
        PF: { ...base.PF, playerId: prev.board?.PF?.playerId ?? rotation.PF ?? null },
        C: { ...base.C, playerId: prev.board?.C?.playerId ?? rotation.C ?? null },
      },
    }));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await saveTactics({
        ...tactics,
        boards: {
          ...(tactics.boards || {}),
          attack: tactics.boards?.attack || tactics.board,
          transition: tactics.boards?.transition || tactics.board,
          defense: tactics.boards?.defense || tactics.board,
        },
        board: {
          ...(tactics.boards?.attack || tactics.board || {}),
          PG: { ...(tactics.boards?.attack?.PG || tactics.board?.PG || DEFAULT_TACTICS_BOARD.PG), playerId: rotation.PG ?? null },
          SG: { ...(tactics.boards?.attack?.SG || tactics.board?.SG || DEFAULT_TACTICS_BOARD.SG), playerId: rotation.SG ?? null },
          SF: { ...(tactics.boards?.attack?.SF || tactics.board?.SF || DEFAULT_TACTICS_BOARD.SF), playerId: rotation.SF ?? null },
          PF: { ...(tactics.boards?.attack?.PF || tactics.board?.PF || DEFAULT_TACTICS_BOARD.PF), playerId: rotation.PF ?? null },
          C: { ...(tactics.boards?.attack?.C || tactics.board?.C || DEFAULT_TACTICS_BOARD.C), playerId: rotation.C ?? null },
        },
      }, rotation);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tactics-page">
      <PageHeader title="Tactics Center" subtitle="Attack, defense, lineup and the tactics board in one place." />

      <div className="tac-tabs">
        <button type="button" className={`tac-tab ${activeTab === 'attack' ? 'is-active' : ''}`} onClick={() => setActiveTab('attack')}>Attack</button>
        <button type="button" className={`tac-tab ${activeTab === 'defense' ? 'is-active' : ''}`} onClick={() => setActiveTab('defense')}>Defense</button>
        <button type="button" className={`tac-tab ${activeTab === 'board' ? 'is-active' : ''}`} onClick={() => setActiveTab('board')}>Formation & Board</button>
      </div>

      <div className="tac-grid">
        <section className="tac-card tac-main">
          {activeTab === 'attack' ? (
            <div className="tac-panel">
              <h3>Attack Setup</h3>
              <label className="tac-field">
                <span>Offense Style</span>
                <select className="tac-select" value={tactics.offenseStyle} onChange={(e) => setTactics((prev) => ({ ...prev, offenseStyle: e.target.value }))}>
                  <option value="balanced">Balanced</option>
                  <option value="pick_and_roll">Pick and Roll</option>
                  <option value="post_up">Post Up</option>
                  <option value="transition">Transition</option>
                  <option value="iso">Isolation</option>
                </select>
              </label>
              <label className="tac-field">
                <span>Pace</span>
                <select className="tac-select" value={tactics.pace} onChange={(e) => setTactics((prev) => ({ ...prev, pace: e.target.value }))}>
                  <option value="slow">Slow</option>
                  <option value="balanced">Balanced</option>
                  <option value="fast">Fast</option>
                </select>
              </label>
              <div className="tac-slider">
                <div><span>3-Point Emphasis</span><strong>{tactics.threePtFocus}%</strong></div>
                <input type="range" min="0" max="100" value={tactics.threePtFocus} onChange={(e) => setTactics((prev) => ({ ...prev, threePtFocus: clamp01(e.target.value) }))} />
              </div>
              <div className="tac-checks">
                <label><input type="checkbox" checked={tactics.instructions.fastBreak} onChange={(e) => setTactics((prev) => ({ ...prev, instructions: { ...prev.instructions, fastBreak: e.target.checked } }))} /> Fast break opportunities</label>
                <label><input type="checkbox" checked={tactics.instructions.isoStars} onChange={(e) => setTactics((prev) => ({ ...prev, instructions: { ...prev.instructions, isoStars: e.target.checked } }))} /> ISO plays for star players</label>
                <label><input type="checkbox" checked={tactics.instructions.crashBoards} onChange={(e) => setTactics((prev) => ({ ...prev, instructions: { ...prev.instructions, crashBoards: e.target.checked } }))} /> Crash offensive boards</label>
              </div>
            </div>
          ) : null}

          {activeTab === 'defense' ? (
            <div className="tac-panel">
              <h3>Defense Setup</h3>
              <label className="tac-field">
                <span>Defense Scheme</span>
                <select className="tac-select" value={tactics.defenseScheme} onChange={(e) => setTactics((prev) => ({ ...prev, defenseScheme: e.target.value }))}>
                  <option value="drop">Drop</option>
                  <option value="switch">Switch</option>
                  <option value="press">Press</option>
                </select>
              </label>
              <div className="tac-field">
                <span>Defense Mode</span>
                <div className="tac-segment">
                  <button type="button" className={tactics.defenseMode === 'man' ? 'is-active' : ''} onClick={() => setTactics((prev) => ({ ...prev, defenseMode: 'man' }))}>Man (Personal)</button>
                  <button type="button" className={tactics.defenseMode === 'zone' ? 'is-active' : ''} onClick={() => setTactics((prev) => ({ ...prev, defenseMode: 'zone' }))}>Zone</button>
                  <button type="button" className={tactics.defenseMode === 'hybrid' ? 'is-active' : ''} onClick={() => setTactics((prev) => ({ ...prev, defenseMode: 'hybrid' }))}>Hybrid</button>
                </div>
              </div>
              <div className="tac-checks">
                <label><input type="checkbox" checked={tactics.instructions.pressAfterMade} onChange={(e) => setTactics((prev) => ({ ...prev, instructions: { ...prev.instructions, pressAfterMade: e.target.checked } }))} /> Press after made baskets</label>
              </div>
            </div>
          ) : null}

          {activeTab === 'board' ? (
            <div className="tac-panel">
              <div className="tac-board-header">
                <h3>Formation & Tactics Board</h3>
                <select className="tac-select" value={formation} onChange={(e) => applyFormation(e.target.value)}>
                  <option value="traditional">1-2-2 Traditional</option>
                  <option value="spread">1-3-1 Spread</option>
                  <option value="balanced">2-1-2 Balanced</option>
                </select>
              </div>
              <div className="tac-board-modes">
                <button type="button" className={boardMode === 'attack' ? 'is-active' : ''} onClick={() => setBoardMode('attack')}>Attack Board</button>
                <button type="button" className={boardMode === 'transition' ? 'is-active' : ''} onClick={() => setBoardMode('transition')}>Transition Board</button>
                <button type="button" className={boardMode === 'defense' ? 'is-active' : ''} onClick={() => setBoardMode('defense')}>Defense Board</button>
              </div>
              <CourtBoard
                players={squadPlayers}
                board={tactics.boards?.[boardMode] || tactics.board}
                onBoardChange={(nextBoard) => setTactics((prev) => ({
                  ...prev,
                  board: boardMode === 'attack' ? nextBoard : prev.board,
                  boards: {
                    ...(prev.boards || {}),
                    [boardMode]: nextBoard,
                  },
                }))}
              />
            </div>
          ) : null}
        </section>

        <aside className="tac-card tac-side">
          <h3>Starting Five</h3>
          <div className="tac-lineup">
            {POSITION_ORDER.map((slot) => (
              <label key={slot} className="tac-lineup-row">
                <span>{slot}</span>
                <select
                  className="tac-select"
                  value={rotation[slot] ?? ''}
                  onChange={(e) => setRotation((prev) => ({ ...prev, [slot]: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">Unassigned</option>
                  {(playersByPosition[slot] || []).map((player) => (
                    <option key={`${slot}-${player.id}`} value={player.id}>{player.name} ({player.overallCurrent ?? player.overall ?? 0})</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button className="tac-save-btn" type="button" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving...' : 'Save Tactics'}
          </button>
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { CourtBoard, DEFAULT_TACTICS_BOARD } from '../../components/domain/CourtBoard';
import { PageHeader } from '../../components/ui';
import './tactics.css';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

const PHASE_TABS = [
  { id: 'defense', label: 'Defense' },
  { id: 'transition', label: 'Transition' },
  { id: 'attack', label: 'Attack' },
];

const OFFENSE_PRESETS = [
  { id: 'motion', label: 'Motion Offense', description: 'Ball movement and off-ball screens create open shots', rating: 85 },
  { id: 'iso', label: 'Isolation Heavy', description: 'Star players create their own shot in 1-on-1', rating: 78 },
  { id: 'pick_and_roll', label: 'Pick & Roll', description: 'Primary ball handler runs PnR actions', rating: 92 },
  { id: 'post_up', label: 'Post-Up', description: 'Feed the ball to bigs in the post', rating: 78 },
  { id: 'fast_break', label: 'Fast Break', description: 'Push tempo and score in transition', rating: 88 },
];

const DEFENSE_PRESETS = [
  { id: 'man_to_man', label: 'Man-to-Man', description: 'Each defender guards a specific player', rating: 98 },
  { id: 'zone_23', label: '2-3 Zone', description: 'Two guards up top, three players on baseline', rating: 75 },
  { id: 'zone_32', label: '3-2 Zone', description: 'Three guards up top, two players on baseline', rating: 72 },
  { id: 'full_press', label: 'Full Court Press', description: 'Apply pressure full court to force turnovers', rating: 68 },
  { id: 'switch_all', label: 'Switch Everything', description: 'All defenders switch on screens', rating: 82 },
];

const TRANSITION_PRESETS = [
  { id: 'early_offense', label: 'Early Offense', description: 'Attack before the defense is set', rating: 86 },
  { id: 'secondary_break', label: 'Secondary Break', description: 'Flow into quick-hit actions', rating: 82 },
  { id: 'control_push', label: 'Control Push', description: 'Balanced tempo with safe decisions', rating: 79 },
];

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

function normalizePositionTags(player) {
  const raw = `${String(player?.position || '').toUpperCase()} ${String(player?.primaryPosition || '').toUpperCase()}`;
  const tags = new Set();
  POSITION_ORDER.forEach((slot) => {
    if (raw.includes(slot)) tags.add(slot);
  });
  return tags;
}

function detectFormation(board) {
  const b = board || {};
  if (Math.abs((b.SF?.x ?? 0.5) - 0.5) < 0.04) return 'spread';
  if (Math.abs((b.PG?.x ?? 0.5) - 0.5) < 0.04 && Math.abs((b.SG?.x ?? 0.3) - 0.3) < 0.06) return 'traditional';
  return 'balanced';
}

function offenseStyleToPreset(offenseStyle) {
  switch (offenseStyle) {
    case 'pick_and_roll':
      return 'pick_and_roll';
    case 'post_up':
      return 'post_up';
    case 'transition':
      return 'fast_break';
    case 'iso':
      return 'iso';
    default:
      return 'motion';
  }
}

function presetToOffenseStyle(presetId) {
  switch (presetId) {
    case 'pick_and_roll':
      return 'pick_and_roll';
    case 'post_up':
      return 'post_up';
    case 'fast_break':
      return 'transition';
    case 'iso':
      return 'iso';
    default:
      return 'balanced';
  }
}

function defenseToPreset(defenseMode, defenseScheme, defensePreset) {
  if (defensePreset) return defensePreset;
  if (defenseMode === 'zone' && defenseScheme === 'drop') return 'zone_23';
  if (defenseMode === 'zone' && defenseScheme === 'switch') return 'zone_32';
  if (defenseScheme === 'press') return 'full_press';
  if (defenseScheme === 'switch') return 'switch_all';
  return 'man_to_man';
}

function presetToDefense(presetId) {
  switch (presetId) {
    case 'zone_23':
      return { defenseMode: 'zone', defenseScheme: 'drop' };
    case 'zone_32':
      return { defenseMode: 'zone', defenseScheme: 'switch' };
    case 'full_press':
      return { defenseMode: 'hybrid', defenseScheme: 'press' };
    case 'switch_all':
      return { defenseMode: 'man', defenseScheme: 'switch' };
    default:
      return { defenseMode: 'man', defenseScheme: 'drop' };
  }
}

export function Tactics() {
  const { currentSave, squadPlayers, fetchSquad, saveTactics } = useGameStore();
  const [activePhase, setActivePhase] = useState('defense');
  const [saving, setSaving] = useState(false);
  const [formation, setFormation] = useState('traditional');
  const [rotation, setRotation] = useState({ PG: null, SG: null, SF: null, PF: null, C: null });
  const [tactics, setTactics] = useState({
    offensePreset: 'motion',
    defensePreset: 'man_to_man',
    transitionStyle: 'early_offense',
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
    boards: {
      attack: { ...DEFAULT_TACTICS_BOARD },
      transition: { ...DEFAULT_TACTICS_BOARD },
      defense: { ...DEFAULT_TACTICS_BOARD },
    },
  });

  useEffect(() => { fetchSquad(); }, [fetchSquad]);

  useEffect(() => {
    const payload = currentSave?.data || {};
    const storedBoard = { ...DEFAULT_TACTICS_BOARD, ...(payload?.tactics?.board || {}) };
    const boards = payload?.tactics?.boards || {};
    setTactics({
      offensePreset: payload?.tactics?.offensePreset || offenseStyleToPreset(payload?.tactics?.offenseStyle || 'balanced'),
      defensePreset: defenseToPreset(payload?.tactics?.defenseMode, payload?.tactics?.defenseScheme, payload?.tactics?.defensePreset),
      transitionStyle: payload?.tactics?.transitionStyle || 'early_offense',
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
    for (const player of (squadPlayers || [])) {
      const tags = normalizePositionTags(player);
      for (const slot of POSITION_ORDER) {
        if (tags.has(slot)) byPos[slot].push(player);
      }
    }
    for (const slot of POSITION_ORDER) {
      byPos[slot].sort((a, b) => (b.overallCurrent ?? b.overall ?? 0) - (a.overallCurrent ?? a.overall ?? 0));
    }
    return byPos;
  }, [squadPlayers]);

  useEffect(() => {
    setRotation((prev) => {
      let changed = false;
      const next = { ...prev };
      POSITION_ORDER.forEach((slot) => {
        const pool = playersByPosition[slot] || [];
        if (next[slot] && !pool.some((p) => Number(p.id) === Number(next[slot]))) {
          next[slot] = null;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [playersByPosition]);

  const applyFormation = (formationKey) => {
    const base = FORMATIONS[formationKey]?.board || FORMATIONS.traditional.board;
    setFormation(formationKey);
    setTactics((prev) => ({
      ...prev,
      boards: {
        ...(prev.boards || {}),
        [activePhase]: {
          ...(prev.boards?.[activePhase] || {}),
          PG: { ...base.PG, playerId: prev.boards?.[activePhase]?.PG?.playerId ?? rotation.PG ?? null },
          SG: { ...base.SG, playerId: prev.boards?.[activePhase]?.SG?.playerId ?? rotation.SG ?? null },
          SF: { ...base.SF, playerId: prev.boards?.[activePhase]?.SF?.playerId ?? rotation.SF ?? null },
          PF: { ...base.PF, playerId: prev.boards?.[activePhase]?.PF?.playerId ?? rotation.PF ?? null },
          C: { ...base.C, playerId: prev.boards?.[activePhase]?.C?.playerId ?? rotation.C ?? null },
        },
      },
      board: activePhase === 'attack'
        ? {
            PG: { ...base.PG, playerId: prev.board?.PG?.playerId ?? rotation.PG ?? null },
            SG: { ...base.SG, playerId: prev.board?.SG?.playerId ?? rotation.SG ?? null },
            SF: { ...base.SF, playerId: prev.board?.SF?.playerId ?? rotation.SF ?? null },
            PF: { ...base.PF, playerId: prev.board?.PF?.playerId ?? rotation.PF ?? null },
            C: { ...base.C, playerId: prev.board?.C?.playerId ?? rotation.C ?? null },
          }
        : prev.board,
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
      <PageHeader title="Tactics Center" subtitle="Set phase-specific boards and tactical styles for attack, transition, and defense." />

      <div className="tac-tabs">
        {PHASE_TABS.map((tab) => (
          <button key={tab.id} type="button" className={`tac-tab ${activePhase === tab.id ? 'is-active' : ''}`} onClick={() => setActivePhase(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div className="tac-grid">
        <section className="tac-card tac-main">
          <div className="tac-board-header">
            <h3>{activePhase.charAt(0).toUpperCase() + activePhase.slice(1)} Board</h3>
            <select className="tac-select" value={formation} onChange={(e) => applyFormation(e.target.value)}>
              <option value="traditional">1-2-2 Traditional</option>
              <option value="spread">1-3-1 Spread</option>
              <option value="balanced">2-1-2 Balanced</option>
            </select>
          </div>

          <CourtBoard
            players={squadPlayers}
            playersByPosition={playersByPosition}
            view={activePhase}
            board={tactics.boards?.[activePhase] || tactics.board}
            onBoardChange={(nextBoard) => setTactics((prev) => ({
              ...prev,
              board: activePhase === 'attack' ? nextBoard : prev.board,
              boards: {
                ...(prev.boards || {}),
                [activePhase]: nextBoard,
              },
            }))}
          />
        </section>

        <aside className="tac-card tac-side">
          {activePhase !== 'defense' ? (
            <div className="tac-panel">
              <h3>Offense</h3>
              <div className="tac-options-list offense">
                {OFFENSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`tac-option ${tactics.offensePreset === preset.id ? 'is-selected' : ''}`}
                    onClick={() => setTactics((prev) => ({
                      ...prev,
                      offensePreset: preset.id,
                      offenseStyle: presetToOffenseStyle(preset.id),
                      pace: preset.id === 'fast_break' ? 'fast' : prev.pace,
                      instructions: {
                        ...prev.instructions,
                        fastBreak: preset.id === 'fast_break' ? true : prev.instructions.fastBreak,
                        isoStars: preset.id === 'iso' ? true : prev.instructions.isoStars,
                      },
                    }))}
                  >
                    <div className="tac-option-copy">
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </div>
                    <div className="tac-option-score">
                      <div className="tac-option-bar"><span style={{ width: `${preset.rating}%` }} /></div>
                      <em>{preset.rating}</em>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePhase === 'transition' ? (
            <div className="tac-panel">
              <h3>Transition Style</h3>
              <div className="tac-options-list transition">
                {TRANSITION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`tac-option ${tactics.transitionStyle === preset.id ? 'is-selected' : ''}`}
                    onClick={() => setTactics((prev) => ({
                      ...prev,
                      transitionStyle: preset.id,
                      pace: preset.id === 'control_push' ? 'balanced' : 'fast',
                      instructions: {
                        ...prev.instructions,
                        fastBreak: preset.id !== 'control_push',
                      },
                    }))}
                  >
                    <div className="tac-option-copy">
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </div>
                    <div className="tac-option-score">
                      <div className="tac-option-bar"><span style={{ width: `${preset.rating}%` }} /></div>
                      <em>{preset.rating}</em>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePhase !== 'attack' ? (
            <div className="tac-panel">
              <h3>Defense</h3>
              <div className="tac-options-list defense">
                {DEFENSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`tac-option ${tactics.defensePreset === preset.id ? 'is-selected' : ''}`}
                    onClick={() => {
                      const mapped = presetToDefense(preset.id);
                      setTactics((prev) => ({
                        ...prev,
                        defensePreset: preset.id,
                        defenseMode: mapped.defenseMode,
                        defenseScheme: mapped.defenseScheme,
                        instructions: {
                          ...prev.instructions,
                          pressAfterMade: preset.id === 'full_press' ? true : prev.instructions.pressAfterMade,
                        },
                      }));
                    }}
                  >
                    <div className="tac-option-copy">
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </div>
                    <div className="tac-option-score">
                      <div className="tac-option-bar"><span style={{ width: `${preset.rating}%` }} /></div>
                      <em>{preset.rating}</em>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="tac-panel">
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
          </div>

          <button className="tac-save-btn" type="button" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving...' : 'Save Tactics'}
          </button>
        </aside>
      </div>
    </div>
  );
}

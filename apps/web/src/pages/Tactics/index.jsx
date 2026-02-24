import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { CourtBoard, DEFAULT_TACTICS_BOARD } from '../../components/domain/CourtBoard';
import '../Dashboard.css';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

export function Tactics() {
  const {
    currentSave,
    squadPlayers,
    fetchSquad,
    saveTactics,
    saveTrainingPlan,
  } = useGameStore();

  const [tactics, setTactics] = useState({
    pace: 'balanced',
    threePtFocus: 50,
    defenseScheme: 'switch',
    board: DEFAULT_TACTICS_BOARD,
  });
  const [trainingPlan, setTrainingPlan] = useState({
    intensity: 'balanced',
    focus: 'balanced',
  });

  useEffect(() => {
    fetchSquad();
  }, [fetchSquad]);

  useEffect(() => {
    const payload = currentSave?.data || {};
    setTactics({
      pace: payload?.tactics?.pace || 'balanced',
      threePtFocus: Number(payload?.tactics?.threePtFocus ?? 50),
      defenseScheme: payload?.tactics?.defenseScheme || 'switch',
      board: { ...DEFAULT_TACTICS_BOARD, ...(payload?.tactics?.board || {}) },
    });
    setTrainingPlan({
      intensity: payload?.trainingPlan?.intensity || 'balanced',
      focus: payload?.trainingPlan?.focus || 'balanced',
    });
  }, [currentSave]);

  const lineup = useMemo(() => {
    return POSITION_ORDER.map((position) => {
      const player = squadPlayers.find((p) => (p.position || '').includes(position));
      return { position, player: player?.name || 'TBD' };
    });
  }, [squadPlayers]);

  return (
    <div className="dashboard">
      <h2>Tactics & Training</h2>
      <div className="dashboard-grid">
        <div className="card">
          <h3>Probable Starting Five</h3>
          {lineup.map((slot) => (
            <p key={slot.position}><strong>{slot.position}:</strong> {slot.player}</p>
          ))}
        </div>

        <div className="card">
          <h3>Team Tactics</h3>
          <p><strong>Pace</strong></p>
          <select value={tactics.pace} onChange={(e) => setTactics((prev) => ({ ...prev, pace: e.target.value }))}>
            <option value="slow">Slow</option>
            <option value="balanced">Balanced</option>
            <option value="fast">Fast</option>
          </select>

          <p style={{ marginTop: 12 }}><strong>3PT Focus ({tactics.threePtFocus})</strong></p>
          <input
            type="range"
            min="0"
            max="100"
            value={tactics.threePtFocus}
            onChange={(e) => setTactics((prev) => ({ ...prev, threePtFocus: Number(e.target.value) }))}
          />

          <p style={{ marginTop: 12 }}><strong>Defense Scheme</strong></p>
          <select value={tactics.defenseScheme} onChange={(e) => setTactics((prev) => ({ ...prev, defenseScheme: e.target.value }))}>
            <option value="drop">Drop</option>
            <option value="switch">Switch</option>
            <option value="press">Press</option>
          </select>

          <button style={{ marginTop: 12 }} className="btn-primary" onClick={() => saveTactics(tactics)}>
            Save Tactics
          </button>
        </div>

        <div className="card">
          <h3>Tactics Board</h3>
          <CourtBoard
            players={squadPlayers}
            board={tactics.board}
            onBoardChange={(nextBoard) => setTactics((prev) => ({ ...prev, board: nextBoard }))}
          />
          <button style={{ marginTop: 12 }} className="btn-primary" onClick={() => saveTactics(tactics)}>
            Save Board Positions
          </button>
        </div>

        <div className="card">
          <h3>Weekly Training Plan</h3>
          <p><strong>Intensity</strong></p>
          <select value={trainingPlan.intensity} onChange={(e) => setTrainingPlan((prev) => ({ ...prev, intensity: e.target.value }))}>
            <option value="low">Low</option>
            <option value="balanced">Balanced</option>
            <option value="high">High</option>
          </select>

          <p style={{ marginTop: 12 }}><strong>Focus</strong></p>
          <select value={trainingPlan.focus} onChange={(e) => setTrainingPlan((prev) => ({ ...prev, focus: e.target.value }))}>
            <option value="balanced">Balanced</option>
            <option value="shooting">Shooting</option>
            <option value="defense">Defense</option>
            <option value="fitness">Fitness</option>
          </select>

          <button style={{ marginTop: 12 }} className="btn-primary" onClick={() => saveTrainingPlan(trainingPlan)}>
            Save Training Plan
          </button>
        </div>
      </div>
    </div>
  );
}

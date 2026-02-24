import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { CourtBoard, DEFAULT_TACTICS_BOARD } from '../../components/domain/CourtBoard';
import { PageHeader, StatGrid } from '../../components/ui';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

export function Tactics() {
  const { currentSave, squadPlayers, fetchSquad, saveTactics, saveTrainingPlan } = useGameStore();
  const [tactics, setTactics] = useState({ pace: 'balanced', threePtFocus: 50, defenseScheme: 'switch', board: DEFAULT_TACTICS_BOARD });
  const [trainingPlan, setTrainingPlan] = useState({ intensity: 'balanced', focus: 'balanced' });

  useEffect(() => { fetchSquad(); }, [fetchSquad]);
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

  const lineup = useMemo(
    () => POSITION_ORDER.map((position) => ({ position, player: squadPlayers.find((p) => (p.position || '').includes(position))?.name || 'TBD' })),
    [squadPlayers],
  );

  return (
    <div>
      <PageHeader title="Tactics" subtitle="Control pace, scheme, court board positioning and weekly team training defaults." />
      <StatGrid items={[
        { label: 'Pace', value: tactics.pace },
        { label: '3PT Focus', value: tactics.threePtFocus },
        { label: 'Defense', value: tactics.defenseScheme },
        { label: 'Training', value: `${trainingPlan.intensity}/${trainingPlan.focus}` },
      ]} />

      <div className="ui-card-grid">
        <section className="ui-card ui-col-4">
          <h3>Probable Starting Five</h3>
          <div className="ui-list-stack">
            {lineup.map((slot) => <div className="ui-list-item" key={slot.position}><strong>{slot.position}:</strong> {slot.player}</div>)}
          </div>
        </section>

        <section className="ui-card ui-col-4">
          <h3>Team Tactics</h3>
          <div className="ui-list-stack">
            <label><strong>Pace</strong><select className="ui-select" value={tactics.pace} onChange={(e) => setTactics((p) => ({ ...p, pace: e.target.value }))}><option value="slow">Slow</option><option value="balanced">Balanced</option><option value="fast">Fast</option></select></label>
            <label><strong>Defense Scheme</strong><select className="ui-select" value={tactics.defenseScheme} onChange={(e) => setTactics((p) => ({ ...p, defenseScheme: e.target.value }))}><option value="drop">Drop</option><option value="switch">Switch</option><option value="press">Press</option></select></label>
            <label><strong>3PT Focus ({tactics.threePtFocus})</strong><input type="range" min="0" max="100" value={tactics.threePtFocus} onChange={(e) => setTactics((p) => ({ ...p, threePtFocus: Number(e.target.value) }))} /></label>
            <button className="ui-btn ui-btn-primary" onClick={() => saveTactics(tactics)}>Save Tactics</button>
          </div>
        </section>

        <section className="ui-card ui-col-4">
          <h3>Weekly Training Default</h3>
          <div className="ui-list-stack">
            <label><strong>Intensity</strong><select className="ui-select" value={trainingPlan.intensity} onChange={(e) => setTrainingPlan((p) => ({ ...p, intensity: e.target.value }))}><option value="low">Low</option><option value="balanced">Balanced</option><option value="high">High</option></select></label>
            <label><strong>Focus</strong><select className="ui-select" value={trainingPlan.focus} onChange={(e) => setTrainingPlan((p) => ({ ...p, focus: e.target.value }))}><option value="balanced">Balanced</option><option value="shooting">Shooting</option><option value="defense">Defense</option><option value="fitness">Fitness</option></select></label>
            <button className="ui-btn" onClick={() => saveTrainingPlan(trainingPlan)}>Save Training Plan</button>
          </div>
        </section>

        <section className="ui-card ui-col-12">
          <h3>Tactics Board</h3>
          <CourtBoard players={squadPlayers} board={tactics.board} onBoardChange={(nextBoard) => setTactics((p) => ({ ...p, board: nextBoard }))} />
          <div style={{ marginTop: 12 }}>
            <button className="ui-btn ui-btn-primary" onClick={() => saveTactics(tactics)}>Save Board Positions</button>
          </div>
        </section>
      </div>
    </div>
  );
}


export function SimulationControls({
  running,
  onContinue,
  onPause,
  onSimHalftime,
  onSimEnd,
  autoCoach,
  onToggleAutoCoach,
}) {
  return (
    <section className="md-sim-controls ui-card">
      <h3>Simulation Workflow</h3>
      <div className="md-sim-grid">
        <button className="ui-btn ui-btn-primary" type="button" onClick={running ? onPause : onContinue}>
          {running ? 'Pause Simulation' : 'Continue Simulation'}
        </button>
        <button className="ui-btn" type="button" onClick={onSimHalftime}>Sim To Halftime</button>
        <button className="ui-btn" type="button" onClick={onSimEnd}>Sim To End</button>
        <button className={`ui-btn ${autoCoach ? 'is-active' : ''}`} type="button" onClick={onToggleAutoCoach}>
          Auto-Coach: {autoCoach ? 'On' : 'Off'}
        </button>
      </div>
    </section>
  );
}

const BUTTONS = [
  { key: 'fullCourtPress', label: 'Full Court Press' },
  { key: 'zoneDefense', label: 'Zone Defense' },
  { key: 'manDefense', label: 'Man-to-Man' },
  { key: 'crashBoards', label: 'Crash Boards' },
  { key: 'transitionPush', label: 'Run in Transition' },
  { key: 'slowPace', label: 'Slow Pace' },
  { key: 'isoPlays', label: 'Iso Plays' },
  { key: 'feedPost', label: 'Feed the Post' },
  { key: 'benchRotation', label: 'Bench Rotation' },
];

export function TacticalControls({
  tactics,
  onToggle,
  onSetDefenseMode,
  onTimeout,
}) {
  return (
    <section className="md-tactics ui-card">
      <div className="md-panel-head">
        <h3>Tactical Adjustments</h3>
        <button className="ui-btn" type="button" onClick={onTimeout}>Timeout</button>
      </div>

      <div className="md-tactic-grid">
        {BUTTONS.map((button) => {
          if (button.key === 'zoneDefense') {
            const active = tactics.defenseMode === 'zone';
            return (
              <button key={button.key} type="button" className={`ui-btn ${active ? 'is-active' : ''}`} onClick={() => onSetDefenseMode(active ? 'man' : 'zone')}>
                {button.label}
              </button>
            );
          }
          if (button.key === 'manDefense') {
            const active = tactics.defenseMode === 'man';
            return (
              <button key={button.key} type="button" className={`ui-btn ${active ? 'is-active' : ''}`} onClick={() => onSetDefenseMode('man')}>
                {button.label}
              </button>
            );
          }
          return (
            <button key={button.key} type="button" className={`ui-btn ${tactics[button.key] ? 'is-active' : ''}`} onClick={() => onToggle(button.key)}>
              {button.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}


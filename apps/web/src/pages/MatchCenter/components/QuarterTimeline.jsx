export function QuarterTimeline({ away, home, awayLabel, homeLabel }) {
  const totalAway = away.reduce((sum, val) => sum + (Number(val) || 0), 0);
  const totalHome = home.reduce((sum, val) => sum + (Number(val) || 0), 0);
  return (
    <section className="md-quarter ui-card">
      <h3>Quarter Timeline</h3>
      <div className="md-quarter-table">
        <div className="head"><span>Team</span><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span><span>OT</span><span>Final</span></div>
        <div><span>{awayLabel}</span><span>{away[0] || 0}</span><span>{away[1] || 0}</span><span>{away[2] || 0}</span><span>{away[3] || 0}</span><span>{away[4] || 0}</span><strong>{totalAway}</strong></div>
        <div><span>{homeLabel}</span><span>{home[0] || 0}</span><span>{home[1] || 0}</span><span>{home[2] || 0}</span><span>{home[3] || 0}</span><span>{home[4] || 0}</span><strong>{totalHome}</strong></div>
      </div>
      <div className="md-momentum">
        <small>Momentum</small>
        <div className="bar">
          <span style={{ width: `${Math.max(0, Math.min(100, 50 + ((totalHome - totalAway) * 2)))}%` }} />
        </div>
      </div>
    </section>
  );
}


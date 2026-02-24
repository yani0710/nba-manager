export function StatGrid({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="ui-stat-grid">
      {items.map((item) => (
        <div key={item.label} className="ui-stat-tile">
          <div className="ui-stat-label">{item.label}</div>
          <div className="ui-stat-value">{item.value}</div>
          {item.help ? <div className="ui-stat-help">{item.help}</div> : null}
        </div>
      ))}
    </div>
  );
}


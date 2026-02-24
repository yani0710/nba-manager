export function EmptyState({ title = 'No data yet', description = '', action = null }) {
  return (
    <div className="ui-empty-state">
      <div className="ui-empty-icon" aria-hidden="true">○</div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}


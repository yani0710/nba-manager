import { ROLE_OPTIONS, toMoneyMillions } from '../rosterUtils';

function DetailRow({ label, value }) {
  return (
    <p>
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

export function PlayerDetailPanel({
  player,
  comparePlayers,
  onToggleTradeBlock,
  onToggleDevelopment,
  onToggleCompare,
  onChangeRole,
  onViewProfile,
  onRequestExtension,
  onScoutSimilar,
}) {
  if (!player) {
    return (
      <aside className="player-detail-card empty">
        <h3>Selected Player</h3>
        <p>Select a row to open detailed information and quick actions.</p>
      </aside>
    );
  }

  return (
    <aside className="player-detail-card">
      <div className="player-detail-head">
        <h3>{player.name}</h3>
        <span>{player.position} | #{player.jersey}</span>
      </div>
      <div className="player-detail-grid">
        <DetailRow label="Overall" value={player.overall} />
        <DetailRow label="Potential" value={player.potential} />
        <DetailRow label="Age" value={player.age ?? '--'} />
        <DetailRow label="Salary" value={toMoneyMillions(player.salary)} />
        <DetailRow label="Contract Years" value={player.contractYears || '-'} />
        <DetailRow label="Morale" value={player.morale} />
        <DetailRow label="Fitness" value={player.fitness} />
        <DetailRow label="Injury" value={player.injuryStatus} />
      </div>

      <label className="detail-role-label">
        Role
        <select value={player.role} onChange={(e) => onChangeRole(player, e.target.value)}>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </label>

      <div className="player-actions">
        <button type="button" onClick={() => onViewProfile(player)}>View Profile</button>
        <button type="button" onClick={() => onToggleTradeBlock(player)}>
          {player.onTradeBlock ? 'Remove Trade Block' : 'Move to Trade Block'}
        </button>
        <button type="button" onClick={() => onRequestExtension(player)}>Offer Extension</button>
        <button type="button" onClick={() => onToggleDevelopment(player)}>
          {player.onDevelopment ? 'Promote' : 'Send to Development League'}
        </button>
        <button type="button" onClick={() => onToggleCompare(player)}>
          {player.inCompare ? 'Remove Compare' : 'Compare'}
        </button>
        <button type="button" onClick={() => onScoutSimilar(player)}>Scout Similar Players</button>
      </div>

      <div className="compare-strip">
        <h4>Compare Mode</h4>
        {comparePlayers.length === 0 ? (
          <p>No players selected for comparison.</p>
        ) : (
          comparePlayers.map((p) => (
            <article key={p.id}>
              <strong>{p.name}</strong>
              <span>OVR {p.overall} | POT {p.potential} | {toMoneyMillions(p.salary)}</span>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

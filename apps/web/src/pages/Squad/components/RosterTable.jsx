import { toMoneyMillions } from '../rosterUtils';

const SORTABLE_COLUMNS = new Set([
  'position',
  'name',
  'age',
  'overall',
  'potential',
  'salary',
  'contractYears',
  'morale',
  'fitness',
  'injury',
  'ppg',
  'rpg',
  'apg',
  'defense',
  'shooting',
  'playmaking',
  'tradeValue',
]);

const HEADERS = [
  { key: 'jersey', label: '#' },
  { key: 'position', label: 'Pos' },
  { key: 'name', label: 'Player' },
  { key: 'age', label: 'Age' },
  { key: 'overall', label: 'OVR' },
  { key: 'potential', label: 'POT' },
  { key: 'salary', label: 'Salary' },
  { key: 'contractYears', label: 'Years' },
  { key: 'morale', label: 'Morale' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'injury', label: 'Injury' },
  { key: 'ppg', label: 'PPG' },
  { key: 'rpg', label: 'RPG' },
  { key: 'apg', label: 'APG' },
  { key: 'defense', label: 'Def' },
  { key: 'shooting', label: 'Shoot' },
  { key: 'playmaking', label: 'Play' },
  { key: 'tradeValue', label: 'Trade' },
];

function sortIndicator(column, sortBy, sortDir) {
  if (column !== sortBy) return '';
  return sortDir === 'asc' ? '↑' : '↓';
}

export function RosterTable({
  players,
  selectedPlayerId,
  onSelectPlayer,
  sortBy,
  sortDir,
  onSort,
}) {
  return (
    <div className="roster-table-shell">
      <table className="roster-table">
        <thead>
          <tr>
            {HEADERS.map((header) => {
              const sortable = SORTABLE_COLUMNS.has(header.key);
              return (
                <th key={header.key}>
                  {sortable ? (
                    <button type="button" className="roster-th-sort" onClick={() => onSort(header.key)}>
                      {header.label} <span>{sortIndicator(header.key, sortBy, sortDir)}</span>
                    </button>
                  ) : (
                    <span>{header.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr
              key={`${player.source}-${player.id}`}
              className={selectedPlayerId === player.id ? 'is-selected' : ''}
              onClick={() => onSelectPlayer(player)}
            >
              <td>{player.jersey}</td>
              <td>{player.position || '-'}</td>
              <td>
                <div className="roster-name-cell">
                  <strong>{player.name}</strong>
                  <small>{player.nationality || 'N/A'}</small>
                </div>
              </td>
              <td>{player.age ?? '--'}</td>
              <td>{player.overall}</td>
              <td>{player.potential}</td>
              <td>{toMoneyMillions(player.salary)}</td>
              <td>{player.contractYears || '-'}</td>
              <td>{player.morale}</td>
              <td>{player.fitness}</td>
              <td><span className={`injury-pill ${player.injuryStatus === 'Healthy' ? 'healthy' : 'injured'}`}>{player.injuryStatus}</span></td>
              <td>{player.ppg.toFixed(1)}</td>
              <td>{player.rpg.toFixed(1)}</td>
              <td>{player.apg.toFixed(1)}</td>
              <td>{player.defense}</td>
              <td>{player.shooting}</td>
              <td>{player.playmaking}</td>
              <td>{player.tradeValue.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

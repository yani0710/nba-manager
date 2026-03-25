/**
 * Domain component - Player Table
 */

import { formatSalary } from '../../utils/format';
import './PlayerTable.css';

export function PlayerTable({ players = [] }) {
  return (
    <table className="player-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Position</th>
          <th>Salary</th>
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr key={player.id}>
            <td className="number">{player.jerseyCode ?? player.jerseyNumber ?? player.number ?? '-'}</td>
            <td className="name">{player.name}</td>
            <td>{player.position}</td>
            <td>{formatSalary(player.salary)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

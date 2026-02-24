import { useEffect, useMemo, useRef, useState } from 'react';
import './CourtBoard.css';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const DEFAULT_BOARD = {
  PG: { playerId: null, x: 0.25, y: 0.7 },
  SG: { playerId: null, x: 0.4, y: 0.75 },
  SF: { playerId: null, x: 0.6, y: 0.72 },
  PF: { playerId: null, x: 0.55, y: 0.55 },
  C: { playerId: null, x: 0.5, y: 0.35 },
};

function clamp01(value) {
  return Math.max(0.05, Math.min(0.95, value));
}

export function CourtBoard({ players = [], board = {}, onBoardChange }) {
  const rootRef = useRef(null);
  const [dragPos, setDragPos] = useState(() => ({ ...DEFAULT_BOARD, ...(board || {}) }));
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    setDragPos({ ...DEFAULT_BOARD, ...(board || {}) });
  }, [board]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event) => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const x = clamp01((event.clientX - rect.left) / rect.width);
      const y = clamp01((event.clientY - rect.top) / rect.height);

      setDragPos((prev) => {
        const next = {
          ...prev,
          [dragging]: {
            ...(prev[dragging] || DEFAULT_BOARD[dragging]),
            x,
            y,
          },
        };
        onBoardChange?.(next);
        return next;
      });
    };

    const onUp = () => setDragging(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, onBoardChange]);

  const assignPlayer = (position, playerId) => {
    setDragPos((prev) => {
      const next = {
        ...prev,
        [position]: {
          ...(prev[position] || DEFAULT_BOARD[position]),
          playerId: playerId ? Number(playerId) : null,
        },
      };
      onBoardChange?.(next);
      return next;
    });
  };

  return (
    <div className="court-board-wrap">
      <div ref={rootRef} className="court-board">
        <div className="court-key" />
        <div className="court-rim" />
        <div className="court-arc" />
        <div className="court-three" />

        {POSITIONS.map((position) => {
          const slot = dragPos[position] || DEFAULT_BOARD[position];
          const player = slot.playerId ? playerMap.get(slot.playerId) : null;
          return (
            <button
              key={position}
              className="court-token"
              style={{
                left: `${(slot.x || 0.5) * 100}%`,
                top: `${(slot.y || 0.5) * 100}%`,
              }}
              onMouseDown={() => setDragging(position)}
              type="button"
            >
              <span className="token-pos">{position}</span>
              <small className="token-name">{player?.name || 'Unassigned'}</small>
            </button>
          );
        })}
      </div>

      <div className="court-assignments">
        {POSITIONS.map((position) => (
          <label key={position}>
            <strong>{position}</strong>
            <select
              value={dragPos[position]?.playerId ?? ''}
              onChange={(e) => assignPlayer(position, e.target.value)}
            >
              <option value="">Unassigned</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} ({player.position})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

export const DEFAULT_TACTICS_BOARD = DEFAULT_BOARD;

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

function toDisplayCoord(view, slot) {
  const x = clamp01(slot?.x ?? 0.5);
  const y = clamp01(slot?.y ?? 0.5);
  if (view === 'defense') {
    return { x, y: clamp01(1 - y) };
  }
  if (view === 'transition') {
    return { x, y: clamp01((y * 0.82) + 0.09) };
  }
  return { x, y };
}

function toStorageCoord(view, x, y) {
  if (view === 'defense') {
    return { x, y: clamp01(1 - y) };
  }
  if (view === 'transition') {
    return { x, y: clamp01((y - 0.09) / 0.82) };
  }
  return { x, y };
}

export function CourtBoard({ players = [], playersByPosition = null, board = {}, onBoardChange, view = 'attack' }) {
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
      const rawX = clamp01((event.clientX - rect.left) / rect.width);
      const rawY = clamp01((event.clientY - rect.top) / rect.height);
      const { x, y } = toStorageCoord(view, rawX, rawY);

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
  }, [dragging, onBoardChange, view]);

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
      <div ref={rootRef} className={`court-board court-board-${view}`}>
        {view === 'transition' ? (
          <>
            <div className="court-mid-line" />
            <div className="court-mid-circle" />
            <div className="court-key-top" />
            <div className="court-key-bottom" />
            <div className="court-rim-top" />
            <div className="court-rim-bottom" />
          </>
        ) : (
          <>
            <div className="court-key" />
            <div className="court-rim" />
            <div className="court-arc" />
            <div className="court-three" />
          </>
        )}

        {POSITIONS.map((position) => {
          const slot = dragPos[position] || DEFAULT_BOARD[position];
          const ui = toDisplayCoord(view, slot);
          const player = slot.playerId ? playerMap.get(slot.playerId) : null;
          return (
            <button
              key={position}
              className="court-token"
              style={{
                left: `${(ui.x || 0.5) * 100}%`,
                top: `${(ui.y || 0.5) * 100}%`,
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
              {(playersByPosition?.[position] || players).map((player) => (
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

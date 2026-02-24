import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../SaveLoad.css';

export function Inbox() {
  const { inbox, fetchInbox, markInboxRead, deleteInboxMessage } = useGameStore();
  const [openedId, setOpenedId] = useState(null);
  const take = inbox?.take ?? 30;
  const skip = inbox?.skip ?? 0;
  const total = inbox?.total ?? 0;
  const hasPrev = skip > 0;
  const hasNext = skip + take < total;

  useEffect(() => {
    fetchInbox({ take: 50, skip: 0 });
  }, [fetchInbox]);

  const openMessage = async (message) => {
    setOpenedId(message.id);
    if (!message.read) {
      await markInboxRead(message.id);
    }
  };

  return (
    <div className="save-load">
      <h2>Inbox</h2>
      <p>Total: {total} | Unread: {inbox?.unread ?? 0}</p>
      <div className="saves-list">
        {(inbox?.messages ?? []).map((message) => (
          <div key={message.id} className="save-item">
            <div>
              <h4>{message.subject}</h4>
              <p>{message.from} | {message.createdAt}</p>
              {openedId === message.id ? <p>{message.body}</p> : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-load" onClick={() => openMessage(message)}>
                {openedId === message.id ? 'Opened' : 'Open'}
              </button>
              <button className="btn-load" onClick={() => markInboxRead(message.id)}>
                Mark Read
              </button>
              <button className="btn-load" onClick={() => deleteInboxMessage(message.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {(inbox?.messages ?? []).length === 0 && <p>No inbox messages yet.</p>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-load" disabled={!hasPrev} onClick={() => fetchInbox({ take, skip: Math.max(0, skip - take) })}>
          Prev
        </button>
        <button className="btn-load" disabled={!hasNext} onClick={() => fetchInbox({ take, skip: skip + take })}>
          Next
        </button>
      </div>
    </div>
  );
}


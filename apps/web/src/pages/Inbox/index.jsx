import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonTable } from '../../components/ui';

export function Inbox() {
  const { inbox, fetchInbox, markInboxRead, deleteInboxMessage, loading } = useGameStore();
  const [openedId, setOpenedId] = useState(null);
  const take = inbox?.take ?? 30;
  const skip = inbox?.skip ?? 0;
  const total = inbox?.total ?? 0;

  useEffect(() => {
    fetchInbox({ take: 50, skip: 0 });
  }, [fetchInbox]);

  const openMessage = async (message) => {
    setOpenedId(message.id);
    if (!message.read) await markInboxRead(message.id);
  };

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="Board, media, scouting and training messages for the current save."
        actions={<span className="ui-badge">Unread {inbox?.unread ?? 0}</span>}
      />

      {loading ? <SkeletonTable rows={6} cols={4} /> : null}

      {!loading && (inbox?.messages ?? []).length === 0 ? (
        <EmptyState title="No inbox messages" description="Messages will appear as games advance and staff reports arrive." />
      ) : null}

      {!loading && (inbox?.messages ?? []).length > 0 ? (
        <div className="ui-card">
          <div className="ui-table-shell">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>From</th>
                  <th>Status</th>
                  <th className="ui-num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(inbox?.messages ?? []).map((message) => (
                  <tr key={message.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{message.subject}</div>
                      <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>{message.createdAt}</div>
                      {openedId === message.id ? <div style={{ marginTop: 8 }}>{message.body}</div> : null}
                    </td>
                    <td>{message.from}</td>
                    <td>
                      <span className={`ui-badge ${message.read ? '' : 'is-positive'}`}>
                        {message.read ? 'Read' : 'Unread'}
                      </span>
                    </td>
                    <td className="ui-num">
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button className="ui-btn" onClick={() => openMessage(message)}>
                          {openedId === message.id ? 'Opened' : 'Open'}
                        </button>
                        <button className="ui-btn" onClick={() => markInboxRead(message.id)}>Read</button>
                        <button className="ui-btn" onClick={() => deleteInboxMessage(message.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="ui-btn" disabled={skip <= 0} onClick={() => fetchInbox({ take, skip: Math.max(0, skip - take) })}>Prev</button>
            <button className="ui-btn" disabled={skip + take >= total} onClick={() => fetchInbox({ take, skip: skip + take })}>Next</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}


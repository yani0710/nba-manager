import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader } from '../../components/ui';
import './inbox.css';

function typeBadge(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'player') return 'player';
  if (t === 'staff') return 'staff';
  if (t === 'scouting') return 'scout';
  if (t === 'media') return 'media';
  if (t === 'board') return 'board';
  return 'system';
}

export function Inbox() {
  const {
    inbox,
    fetchInbox,
    markInboxRead,
    respondInboxMessage,
    loading,
  } = useGameStore();
  const [openedId, setOpenedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInbox({ take: 50, skip: 0 });
  }, [fetchInbox]);

  const messages = inbox?.messages || [];
  const selected = useMemo(
    () => messages.find((m) => String(m.id) === String(openedId)) || messages[0] || null,
    [messages, openedId],
  );

  useEffect(() => {
    if (!openedId && messages.length > 0) {
      setOpenedId(messages[0].id);
    }
  }, [openedId, messages]);

  const openMessage = async (message) => {
    setOpenedId(message.id);
    if (!message.read) {
      await markInboxRead(message.id);
    }
  };

  const submitResponse = async (message, responseId) => {
    if (!message?.id || !responseId || submitting) return;
    setSubmitting(true);
    try {
      await respondInboxMessage(message.id, responseId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="inbox-page">
      <PageHeader
        title="Inbox"
        subtitle={`${inbox?.unread ?? 0} unread messages`}
      />

      {loading && messages.length === 0 ? (
        <div className="inbox-shell">
          <div className="inbox-list-panel" />
          <div className="inbox-detail-panel" />
        </div>
      ) : null}

      {!loading && messages.length === 0 ? (
        <section className="ui-card">
          <EmptyState title="No messages" description="Advance days and check back for player, staff, scout and media messages." />
        </section>
      ) : null}

      {messages.length > 0 ? (
        <div className="inbox-shell">
          <section className="inbox-list-panel">
            {messages.map((message) => {
              const active = String(selected?.id) === String(message.id);
              const badge = typeBadge(message.type);
              return (
                <button
                  key={message.id}
                  type="button"
                  className={`inbox-row ${active ? 'is-active' : ''}`}
                  onClick={() => openMessage(message)}
                >
                  <div className="inbox-row-head">
                    <strong>{message.from}</strong>
                    <span className={`inbox-type ${badge}`}>{badge}</span>
                  </div>
                  <div className="inbox-row-title">{message.subject}</div>
                  <div className="inbox-row-preview">{message.preview || message.body}</div>
                  <div className="inbox-row-foot">
                    <span>{message.createdAt}</span>
                    {message.needsResponse && !message.responded ? <span className="inbox-needs">Needs Response</span> : null}
                    {!message.read ? <span className="inbox-unread-dot" /> : null}
                  </div>
                </button>
              );
            })}
          </section>

          <section className="inbox-detail-panel">
            {!selected ? (
              <EmptyState title="Select a message" description="Open a message from the list to view details." />
            ) : (
              <div className="inbox-detail-card">
                <div className="inbox-detail-top">
                  <div>
                    <div className="inbox-detail-from">{selected.from}</div>
                    <h3>{selected.subject}</h3>
                    <div className="inbox-detail-date">{selected.createdAt}</div>
                  </div>
                  <span className={`inbox-type ${typeBadge(selected.type)}`}>{typeBadge(selected.type)}</span>
                </div>
                <p className="inbox-detail-body">{selected.body}</p>

                {selected.needsResponse && !selected.responded ? (
                  <div className="inbox-replies">
                    <h4>Your Response</h4>
                    <div className="inbox-reply-list">
                      {(selected.choices || []).map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          className="inbox-reply-btn"
                          disabled={submitting}
                          onClick={() => submitResponse(selected, choice.id)}
                        >
                          <span>{choice.label}</span>
                          {Number.isFinite(choice.moraleDelta)
                            ? <small>Morale {choice.moraleDelta >= 0 ? `+${choice.moraleDelta}` : choice.moraleDelta}</small>
                            : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selected.needsResponse && selected.responded ? (
                  <div className="inbox-responded">Response sent.</div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}


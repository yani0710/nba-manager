import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../SaveLoad.css';

function formatDate(value) {
  if (!value) return '--';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return String(value).slice(0, 10);
  }
}

function initials(label) {
  return String(label || '')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'SV';
}

export function SaveLoad() {
  const { saves, createSave, loadSave, fetchSaves, deleteSave, currentSave } = useGameStore();
  const [creating, setCreating] = useState(false);
  const sorted = useMemo(
    () => [...(saves || [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [saves],
  );

  useEffect(() => {
    fetchSaves();
  }, [fetchSaves]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const nextNumber = (sorted?.length ?? 0) + 1;
      await createSave({
        name: `Career ${nextNumber}`,
        description: `Career save #${nextNumber}`,
      });
      await fetchSaves();
      window.location.hash = 'dashboard';
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (saveId) => {
    const ok = window.confirm('Delete this career save? This cannot be undone.');
    if (!ok) return;
    await deleteSave(saveId);
    await fetchSaves();
  };

  return (
    <div className="career-saves-page">
      <div className="career-saves-header">
        <div>
          <h1>Career Saves</h1>
          <p>Manage your career saves and start new ones</p>
        </div>
        <button type="button" className="career-new-btn" onClick={handleCreate} disabled={creating}>
          + {creating ? 'Creating...' : 'New Career'}
        </button>
      </div>

      <div className="career-grid">
        {sorted.map((save) => {
          const teamName = save?.team?.name || save?.data?.career?.teamShortName || save.name;
          const season = save?.season || save?.data?.season || '--';
          const week = save?.data?.week ?? '--';
          const currentDate = save?.data?.currentDate ? String(save.data.currentDate).slice(0, 10) : '--';
          const unread = save?.data?.inboxUnread ?? 0;
          const isLoaded = currentSave?.id === save.id;

          return (
            <article key={save.id} className="career-card">
              <div className="career-card-top">
                <div className="career-avatar">{initials(teamName)}</div>
              </div>

              <h3>{teamName}</h3>
              <div className="career-sub">{isLoaded ? 'Current Career' : 'Career Save'}</div>

              <div className="career-meta">
                <div>
                  <span>Season</span>
                  <strong>{season}</strong>
                </div>
                <div>
                  <span>Week</span>
                  <strong>{week}</strong>
                </div>
                <div>
                  <span>Date</span>
                  <strong>{currentDate}</strong>
                </div>
                <div>
                  <span>Inbox</span>
                  <strong>{unread} unread</strong>
                </div>
              </div>

              <div className="career-last-played">Last played: {formatDate(save.updatedAt)}</div>

              <div className="career-actions">
                <button
                  type="button"
                  className={`career-load-btn ${isLoaded ? 'is-loaded' : ''}`}
                  onClick={async () => { await loadSave(save.id); window.location.hash = 'dashboard'; }}
                >
                  {isLoaded ? 'Loaded Career' : 'Load Career'}
                </button>
                <button type="button" className="career-delete-btn" onClick={() => onDelete(save.id)}>Del</button>
              </div>
            </article>
          );
        })}

        <button type="button" className="career-add-card" onClick={handleCreate} disabled={creating}>
          <span>+</span>
        </button>
      </div>
    </div>
  );
}

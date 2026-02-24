import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader } from '../../components/ui';

export function SaveLoad() {
  const { saves, createSave, loadSave, fetchSaves, currentSave } = useGameStore();
  const [newSaveName, setNewSaveName] = useState('');

  useEffect(() => {
    fetchSaves();
  }, [fetchSaves]);

  const handleCreate = async () => {
    if (!newSaveName.trim()) return;
    await createSave(newSaveName);
    setNewSaveName('');
  };

  return (
    <div>
      <PageHeader title="Save Manager" subtitle="Create, load and switch career saves." />

      <div className="ui-card-grid">
        <section className="ui-card ui-col-4">
          <h3>Create Save</h3>
          <div className="ui-list-stack">
            <input
              className="ui-input"
              type="text"
              placeholder="New save name..."
              value={newSaveName}
              onChange={(e) => setNewSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button onClick={handleCreate} className="ui-btn ui-btn-primary">Create Save</button>
          </div>
        </section>

        <section className="ui-card ui-col-8">
          <h3>Saves</h3>
          {saves.length === 0 ? (
            <EmptyState title="No saves found" description="Create your first save to start a career." />
          ) : (
            <div className="ui-list-stack">
              {saves.map((save) => (
                <div key={save.id} className="ui-list-item" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{save.name}</div>
                    <div style={{ color: 'var(--ui-text-muted)', fontSize: 13 }}>
                      Season {save.data.season} • Week {save.data.week}
                    </div>
                  </div>
                  <button onClick={() => loadSave(save.id)} className={`ui-btn ${currentSave?.id === save.id ? 'ui-btn-primary' : ''}`}>
                    {currentSave?.id === save.id ? 'Loaded' : 'Load'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


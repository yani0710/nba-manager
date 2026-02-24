import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import '../SaveLoad.css';

export function SaveLoad() {
  const { saves, createSave, loadSave, fetchSaves, currentSave } = useGameStore();
  const [newSaveName, setNewSaveName] = useState('');

  useEffect(() => {
    fetchSaves();
  }, [fetchSaves]);

  const handleCreate = async () => {
    if (newSaveName.trim()) {
      await createSave(newSaveName);
      setNewSaveName('');
    }
  };

  return (
    <div className="save-load">
      <h2>Saves</h2>
      <div className="save-input">
        <input
          type="text"
          placeholder="New save name..."
          value={newSaveName}
          onChange={(e) => setNewSaveName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button onClick={handleCreate} className="btn-primary">
          Create Save
        </button>
      </div>

      <div className="saves-list">
        {saves.map((save) => (
          <div key={save.id} className="save-item">
            <div>
              <h4>{save.name}</h4>
              <p>Season {save.data.season} - Week {save.data.week}</p>
            </div>
            <button
              onClick={() => loadSave(save.id)}
              className={`btn-load ${currentSave?.id === save.id ? 'active' : ''}`}
            >
              {currentSave?.id === save.id ? '✓ Loaded' : 'Load'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import './start.css';

const SEASON_OPTIONS = ['2025-26', '2024-25', '2023-24'];

export function Start({ onReady }) {
  const {
    saves,
    teams,
    coachPresets,
    fetchSaves,
    fetchTeams,
    fetchCoachPresets,
    createSave,
    loadSave,
    loading,
  } = useGameStore();
  const [mode, setMode] = useState('create');
  const [managerName, setManagerName] = useState('');
  const [username, setUsername] = useState('');
  const [saveName, setSaveName] = useState('');
  const [season, setSeason] = useState('2025-26');
  const [coachAvatar, setCoachAvatar] = useState('spoelstra');
  const [teamShortName, setTeamShortName] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSaves();
    fetchTeams();
    fetchCoachPresets();
  }, [fetchSaves, fetchTeams, fetchCoachPresets]);

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);

  const createSeason = async () => {
    if (!managerName.trim() || !username.trim()) return;

    const finalSaveName = saveName.trim() || `${managerName} - ${season}`;
    const startDate = `${season.split('-')[0]}-10-01`;

    setSubmitError('');
    setSubmitting(true);
    try {
      await createSave({
        name: finalSaveName,
        description: `${managerName} career save`,
        managerName,
        username,
        coachAvatar,
        teamShortName: teamShortName || null,
        season,
        startDate,
      });

      onReady?.();
    } catch (error) {
      setSubmitError(error?.response?.data?.message || error?.message || 'Failed to create save.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadSeason = async (id) => {
    await loadSave(id);
    onReady?.();
  };

  return (
    <div className="start-screen">
      <div className="start-card">
        <h1>NBA Manager</h1>
        <p className="subtitle">Build your career from the front office to the finals.</p>

        <div className="mode-switch">
          <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create New Season</button>
          <button className={mode === 'load' ? 'active' : ''} onClick={() => setMode('load')}>Load Season</button>
        </div>

        {mode === 'create' ? (
          <div className="form-grid">
            <label>
              Manager Name
              <input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Pat Riley Jr." />
            </label>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="general_manager_01" />
            </label>
            <label>
              Save Name
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Optional" />
            </label>
            <label>
              Season
              <select value={season} onChange={(e) => setSeason(e.target.value)}>
                {SEASON_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select value={teamShortName} onChange={(e) => setTeamShortName(e.target.value)}>
                <option value="">Start Unemployed</option>
                {sortedTeams.map((team) => (
                  <option key={team.id} value={team.shortName}>{team.name}</option>
                ))}
              </select>
            </label>
            <div className="coach-picker">
              <span>Coach Avatar</span>
              <div className="coach-list">
                {(coachPresets.length ? coachPresets : [{ id: 'spoelstra', name: 'Erik Spoelstra', imageUrl: '/images/coaches/spoelstra.png' }]).map((coach) => (
                  <button
                    key={coach.id}
                    className={`coach-chip ${coachAvatar === coach.id ? 'selected' : ''}`}
                    onClick={() => setCoachAvatar(coach.id)}
                  >
                    <span>{(coach.name || '').split(' ').map((x) => x[0]).join('').slice(0, 3).toUpperCase()}</span>
                    <small>{coach.name}</small>
                  </button>
                ))}
              </div>
            </div>

            <button disabled={loading || submitting} className="start-btn" onClick={createSeason}>
              {submitting ? 'Creating...' : 'Start Career'}
            </button>
            {submitError ? <p style={{ color: '#ff8a8a', marginTop: 8 }}>{submitError}</p> : null}
          </div>
        ) : (
          <div className="save-list">
            {saves.length === 0 && <p>No saves found.</p>}
            {saves.map((save) => (
              <div key={save.id} className="save-row">
                <div>
                  <strong>{save.name}</strong>
                  <p>{save.data?.season || 'N/A'} | Week {save.data?.week || 1}</p>
                </div>
                <button onClick={() => loadSeason(save.id)}>Load</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import './start.css';

const SEASON_OPTIONS = ['2025-26'];
const TEAM_LOGO_ALIASES = { DAL: 'dal' };

function initials(value) {
  return String(value || '')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'GM';
}

function formatRelativeTime(value) {
  if (!value) return 'Recently played';
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'Recently played';
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function logoPath(shortName) {
  const short = String(shortName || '').toUpperCase();
  const key = TEAM_LOGO_ALIASES[short] || short.toLowerCase();
  return short ? `/images/teams/${key}.png` : '';
}

function normalizeRecord(save) {
  const wins = Number(save?.data?.managerCareer?.currentSeasonWins ?? save?.data?.managerCareer?.wins ?? save?.team?.wins ?? 0);
  const losses = Number(save?.data?.managerCareer?.currentSeasonLosses ?? save?.data?.managerCareer?.losses ?? save?.team?.losses ?? 0);
  return Number.isFinite(wins) && Number.isFinite(losses) ? `${wins}-${losses}` : '0-0';
}

function getCoachFallbacks() {
  return [
    { id: 'spoelstra', name: 'Erik Spoelstra', imageUrl: '/images/coaches/Spoelstra.webp', specialty: 'Defense', style: 'Tactical Style' },
    { id: 'kerr', name: 'Steve Kerr', imageUrl: '/images/coaches/kerr.jpg', specialty: 'Offense', style: 'Motion Style' },
    { id: 'popovich', name: 'Gregg Popovich', imageUrl: '/images/coaches/popovich.jpg', specialty: 'All-Round', style: 'Veteran Style' },
    { id: 'nurse', name: 'Nick Nurse', imageUrl: '/images/coaches/Nurse.webp', specialty: 'Innovation', style: 'Modern Style' },
    { id: 'mazzulla', name: 'Joe Mazzulla', imageUrl: '/images/coaches/Mazzulla.jpg', specialty: 'Analytics', style: 'Progressive Style' },
  ];
}

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
    deleteSave,
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
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchSaves();
    fetchTeams();
    fetchCoachPresets();
  }, [fetchSaves, fetchTeams, fetchCoachPresets]);

  const coaches = coachPresets.length ? coachPresets : getCoachFallbacks();
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const teamMap = useMemo(() => new Map(sortedTeams.map((team) => [String(team.shortName).toUpperCase(), team])), [sortedTeams]);
  const selectedTeam = teamMap.get(String(teamShortName).toUpperCase()) || null;
  const sortedSaves = useMemo(
    () => [...(saves || [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [saves],
  );

  const decoratedSaves = useMemo(() => sortedSaves.map((save) => {
    const short = String(save?.team?.shortName || save?.data?.career?.teamShortName || '').toUpperCase();
    const team = teamMap.get(short) || save?.team || null;
    return {
      ...save,
      manager: save?.coachName || save?.data?.career?.managerName || 'General Manager',
      teamName: team?.name || (short ? `${short} Career` : 'Unemployed Career'),
      teamShort: short || 'NBA',
      teamLogo: logoPath(short),
      record: normalizeRecord(save),
      week: save?.data?.week ?? 1,
      seasonLabel: save?.season || save?.data?.season || '--',
      currentDate: save?.data?.currentDate ? String(save.data.currentDate).slice(0, 10) : '--',
      lastPlayed: formatRelativeTime(save.updatedAt),
    };
  }), [sortedSaves, teamMap]);

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

  const handleLoadSeason = async (id) => {
    await loadSave(id);
    onReady?.();
  };

  const handleDeleteSave = async (id) => {
    const ok = window.confirm('Delete this career save? This cannot be undone.');
    if (!ok) return;
    setDeletingId(id);
    try {
      await deleteSave(id);
      await fetchSaves();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="start-screen">
      <div className="start-hero">
        <div className="start-badge">T</div>
        <h1>NBA Manager</h1>
        <p>Build your career from the front office to the finals.</p>
      </div>

      <div className="start-shell">
        <div className="start-tabs">
          <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>
            Create New Season
          </button>
          <button type="button" className={mode === 'load' ? 'active' : ''} onClick={() => setMode('load')}>
            Load Season
          </button>
        </div>

        {mode === 'create' ? (
          <div className="start-panel">
            <div className="start-form-grid">
              <label>
                <span>Manager Name</span>
                <input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Pat Riley Jr." />
              </label>

              <label>
                <span>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="general_manager_01" />
              </label>

              <label>
                <span>Save Name</span>
                <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="My Championship Run" />
              </label>

              <label>
                <span>Season</span>
                <select value={season} onChange={(e) => setSeason(e.target.value)}>
                  {SEASON_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="start-team-field">
                <span>Team</span>
                <select value={teamShortName} onChange={(e) => setTeamShortName(e.target.value)}>
                  <option value="">Start Unemployed</option>
                  {sortedTeams.map((team) => (
                    <option key={team.id} value={team.shortName}>{team.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="start-team-preview">
              {selectedTeam ? (
                <>
                  <img src={logoPath(selectedTeam.shortName)} alt={selectedTeam.name} />
                  <div>
                    <strong>{selectedTeam.name}</strong>
                    <small>{selectedTeam.conference || 'NBA'} Conference</small>
                  </div>
                </>
              ) : (
                <>
                  <div className="start-unemployed-badge">NBA</div>
                  <div>
                    <strong>Start Unemployed</strong>
                    <small>Begin your career without a club and wait for offers.</small>
                  </div>
                </>
              )}
            </div>

            <div className="start-coach-section">
              <div className="start-section-head">
                <h3>Choose Your Coach Avatar</h3>
                <p>Use the coach portraits you added when you create a new season.</p>
              </div>

              <div className="start-coach-grid">
                {coaches.map((coach) => {
                  const isSelected = coachAvatar === coach.id;
                  return (
                    <button
                      key={coach.id}
                      type="button"
                      className={`start-coach-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setCoachAvatar(coach.id)}
                    >
                      <div className="start-coach-photo">
                        <img
                          src={coach.imageUrl}
                          alt={coach.name}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = 'grid';
                          }}
                        />
                        <span className="start-coach-fallback">{initials(coach.name)}</span>
                      </div>
                      <strong>{coach.name}</strong>
                      <em>{coach.specialty || 'Head Coach'}</em>
                      <small>{coach.style || 'Front Office Style'}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <button disabled={loading || submitting} className="start-btn" onClick={createSeason}>
              {submitting ? 'Creating...' : 'Start Career'}
            </button>
            {submitError ? <p className="start-error">{submitError}</p> : null}
          </div>
        ) : (
          <div className="start-panel">
            <div className="start-section-head">
              <h3>Load Season</h3>
              <p>Each card shows the club, manager, season state, and latest activity so you can jump into the right career fast.</p>
            </div>

            <div className="start-save-list">
              {decoratedSaves.length === 0 ? <p className="start-empty">No saves found yet. Create your first season to get started.</p> : null}

              {decoratedSaves.map((save) => (
                <article key={save.id} className="start-save-card">
                  <div className="start-save-logo">
                    {save.teamLogo ? (
                      <img src={save.teamLogo} alt={save.teamShort} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : <span>{save.teamShort}</span>}
                  </div>

                  <div className="start-save-main">
                    <div className="start-save-title-row">
                      <h4>{save.name}</h4>
                      <span className="start-save-badge">{save.teamShort}</span>
                    </div>
                    <div className="start-save-sub">
                      <span>{save.manager}</span>
                      <span>{save.teamName}</span>
                    </div>
                    <div className="start-save-meta">
                      <span>Season: <b>{save.seasonLabel}</b></span>
                      <span>Week: <b>{save.week}</b></span>
                      <span>Record: <b>{save.record}</b></span>
                    </div>
                  </div>

                  <div className="start-save-side">
                    <small>Last Played</small>
                    <strong>{save.lastPlayed}</strong>
                    <div className="start-save-actions">
                      <button type="button" className="start-load-btn" onClick={() => handleLoadSeason(save.id)}>Load</button>
                      <button
                        type="button"
                        className="start-delete-btn"
                        onClick={() => handleDeleteSave(save.id)}
                        disabled={deletingId === save.id}
                      >
                        {deletingId === save.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

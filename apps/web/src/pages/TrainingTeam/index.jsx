import { useEffect, useMemo, useState } from 'react';
import { EmptyState, PageHeader } from '../../components/ui';
import { useGameStore } from '../../state/gameStore';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const uid = () => `tp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function TrainingTeam() {
  const { currentSave, saveTrainingConfig, fetchTrainingConfig } = useGameStore();
  const training = currentSave?.data?.training || {};
  const weekPlan = training.weekPlan || {};
  const savedProfiles = training.teamProfiles || [];
  const activeTeamProfileId = training.activeTeamProfileId || null;
  const [intensity, setIntensity] = useState(currentSave?.data?.trainingPlan?.intensity || 'balanced');
  const [focus, setFocus] = useState(currentSave?.data?.trainingPlan?.focus || 'balanced');
  const [restDay, setRestDay] = useState('Sun');
  const [profileName, setProfileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { if (currentSave?.id) fetchTrainingConfig(); }, [currentSave?.id, fetchTrainingConfig]);
  useEffect(() => {
    setIntensity(currentSave?.data?.trainingPlan?.intensity || 'balanced');
    setFocus(currentSave?.data?.trainingPlan?.focus || 'balanced');
  }, [currentSave?.data?.trainingPlan?.intensity, currentSave?.data?.trainingPlan?.focus]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  const previewWeekPlan = useMemo(() => ({ ...weekPlan, [restDay]: { intensity: 'low', focus: 'fitness' } }), [weekPlan, restDay]);

  const applyProfile = async (profile) => {
    setIntensity(profile.intensity);
    setFocus(profile.focus);
    if (profile.restDay) setRestDay(profile.restDay);
    await saveTrainingConfig({
      trainingPlan: { intensity: profile.intensity, focus: profile.focus },
      weekPlan: { ...weekPlan, [profile.restDay || 'Sun']: { intensity: 'low', focus: 'fitness' } },
      activeTeamProfileId: profile.id,
    });
    setToast('Profile applied');
  };

  const saveCurrentTraining = async () => {
    setSaving(true);
    try {
      const payload = { trainingPlan: { intensity, focus }, weekPlan: previewWeekPlan, activeTeamProfileId };
      const activeProfile = savedProfiles.find((p) => p.id === activeTeamProfileId);

      if (activeProfile) {
        const nextProfiles = savedProfiles.map((p) => (
          p.id === activeProfile.id ? { ...p, intensity, focus, restDay } : p
        ));
        await saveTrainingConfig({ ...payload, teamProfiles: nextProfiles });
        setToast('Saved + updated active tab');
      } else {
        await saveTrainingConfig(payload);
        setToast('Saved plan (use "Save Tab" to add a tab)');
      }
    } finally {
      setSaving(false);
    }
  };

  const saveAsProfile = async () => {
    const name = profileName.trim();
    if (!name) return;
    const nextProfile = { id: uid(), name, intensity, focus, restDay };
    const nextProfiles = [nextProfile, ...savedProfiles].slice(0, 8);
    await saveTrainingConfig({
      trainingPlan: { intensity, focus },
      weekPlan: previewWeekPlan,
      teamProfiles: nextProfiles,
      activeTeamProfileId: nextProfile.id,
    });
    setProfileName('');
    setToast('Profile saved');
  };

  const deleteProfile = async (id) => {
    const nextProfiles = savedProfiles.filter((p) => p.id !== id);
    await saveTrainingConfig({
      teamProfiles: nextProfiles,
      activeTeamProfileId: activeTeamProfileId === id ? null : activeTeamProfileId,
    });
    setToast('Profile deleted');
  };

  return (
    <div>
      <PageHeader title="Team Training" subtitle="Set weekly team training defaults and save reusable training tabs/profiles." />

      <div className="ui-card-grid">
        <section className="ui-card ui-col-4">
          <h3>Current Plan</h3>
          {toast ? <div className="ui-badge is-positive" style={{ marginBottom: 10 }}>{toast}</div> : null}
          <div className="ui-list-stack">
            <label><strong>Intensity</strong>
              <select className="ui-select" value={intensity} onChange={(e) => setIntensity(e.target.value)}>
                <option value="low">Low</option><option value="balanced">Balanced</option><option value="high">High</option>
              </select>
            </label>
            <label><strong>Focus</strong>
              <select className="ui-select" value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option value="balanced">Balanced</option><option value="shooting">Shooting</option><option value="defense">Defense</option><option value="fitness">Conditioning</option>
              </select>
            </label>
            <label><strong>Rest Day</strong>
              <select className="ui-select" value={restDay} onChange={(e) => setRestDay(e.target.value)}>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <button className="ui-btn ui-btn-primary" onClick={saveCurrentTraining} disabled={saving}>
              {saving ? 'Saving...' : 'Save Team Training'}
            </button>
          </div>
        </section>

        <section className="ui-card ui-col-8">
          <h3>Saved Training Tabs</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
            <input className="ui-input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Save current setup as: e.g. Recovery Week" />
            <button className="ui-btn" onClick={saveAsProfile}>Save Tab</button>
          </div>

          {savedProfiles.length === 0 ? (
            <EmptyState title="No saved team training tabs" description="Save your current plan as a reusable profile tab." />
          ) : (
            <div className="ui-list-stack">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {savedProfiles.map((p) => (
                  <button
                    key={p.id}
                    className={`ui-btn ${activeTeamProfileId === p.id ? 'ui-btn-primary' : ''}`}
                    onClick={() => applyProfile(p)}
                    type="button"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="ui-table-shell">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Intensity</th>
                      <th>Focus</th>
                      <th>Rest Day</th>
                      <th className="ui-num">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedProfiles.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.intensity}</td>
                        <td>{p.focus}</td>
                        <td>{p.restDay || '-'}</td>
                        <td className="ui-num">
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button className="ui-btn" onClick={() => applyProfile(p)}>Open</button>
                            <button className="ui-btn" onClick={() => deleteProfile(p.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

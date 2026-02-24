import { useEffect, useMemo, useState } from 'react';
import { EmptyState, PageHeader } from '../../components/ui';
import { useGameStore } from '../../state/gameStore';

const FOCUS_OPTIONS = [
  { value: 'BALANCED', label: 'Balanced' },
  { value: 'SHOOTING', label: 'Shooting' },
  { value: 'PLAYMAKING', label: 'Playmaking' },
  { value: 'DEFENSE', label: 'Defense' },
  { value: 'CONDITIONING', label: 'Conditioning' },
];

const INTENSITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'BALANCED', label: 'Balanced' },
  { value: 'HIGH', label: 'High' },
];

const fmtDate = (v) => {
  if (!v) return '--';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '--';
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export function TrainingPlayers() {
  const {
    currentSave,
    squadPlayers,
    playerTrainingPlans,
    fetchSquad,
    fetchPlayerTrainingPlans,
    upsertPlayerTrainingPlan,
    deletePlayerTrainingPlan,
  } = useGameStore();

  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [focus, setFocus] = useState('BALANCED');
  const [intensity, setIntensity] = useState('BALANCED');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      await fetchSquad();
      setLoadingPlans(true);
      try {
        await fetchPlayerTrainingPlans();
      } finally {
        if (active) setLoadingPlans(false);
      }
    })();
    return () => { active = false; };
  }, [fetchSquad, fetchPlayerTrainingPlans, currentSave?.id]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return squadPlayers;
    return squadPlayers.filter((p) => {
      const text = `${p.name || ''} ${p.position || ''} ${p.team?.shortName || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [squadPlayers, search]);

  const selected = useMemo(
    () => squadPlayers.find((p) => String(p.id) === String(selectedPlayerId)),
    [squadPlayers, selectedPlayerId],
  );

  const onSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await upsertPlayerTrainingPlan({ playerId: selected.id, focus, intensity });
      setToast({ type: 'success', text: 'Saved' });
    } catch (error) {
      setToast({ type: 'error', text: error?.response?.data?.message || 'Error' });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (plan) => {
    setSelectedPlayerId(String(plan.playerId));
    setFocus(plan.focus || 'BALANCED');
    setIntensity(plan.intensity || 'BALANCED');
  };

  const onDelete = async (plan) => {
    try {
      await deletePlayerTrainingPlan(plan.playerId);
      if (String(plan.playerId) === String(selectedPlayerId)) {
        setSelectedPlayerId('');
      }
      setToast({ type: 'success', text: 'Deleted' });
    } catch (error) {
      setToast({ type: 'error', text: error?.response?.data?.message || 'Error' });
    }
  };

  return (
    <div>
      <PageHeader title="Individual Training" subtitle="Manage save-scoped player training plans with focus and intensity presets." />
      <div className="ui-card-grid" style={{ gridTemplateColumns: 'repeat(12, minmax(0,1fr))' }}>
        <div className="ui-card ui-col-4">
          <h3 style={{ marginTop: 0 }}>Create / Update Plan</h3>
          {toast && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: toast.type === 'error' ? 'rgba(220,80,80,0.18)' : 'rgba(70,170,110,0.18)',
                border: `1px solid ${toast.type === 'error' ? 'rgba(220,80,80,0.35)' : 'rgba(70,170,110,0.35)'}`,
              }}
            >
              {toast.text}
            </div>
          )}

          <label style={{ display: 'block', marginBottom: 8 }}>
            <strong>Search Player</strong>
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roster..."
            className="players-search"
            style={{ width: '100%', marginBottom: 12 }}
          />

          <label style={{ display: 'block', marginBottom: 8 }}>
            <strong>Player</strong>
          </label>
          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="ui-select"
            style={{ marginBottom: 16 }}
          >
            <option value="">Select player</option>
            {filteredPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.position}) - {p.team?.shortName || '--'}
              </option>
            ))}
          </select>

          <div style={{ marginBottom: 16 }}>
            <strong>Focus</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {FOCUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={focus === opt.value ? 'ui-btn ui-btn-primary' : 'ui-btn'}
                  onClick={() => setFocus(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Intensity</strong>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {INTENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={intensity === opt.value ? 'ui-btn ui-btn-primary' : 'ui-btn'}
                  onClick={() => setIntensity(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div style={{ marginBottom: 14, opacity: 0.92 }}>
              <div><strong>{selected.name}</strong> ({selected.position || '--'})</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                OVR {selected.overallCurrent ?? selected.overall ?? '--'} | Form {selected.form ?? '--'} | Fatigue {selected.fatigue ?? '--'}
              </div>
            </div>
          )}

          <button className="ui-btn ui-btn-primary" onClick={onSave} disabled={!selected || saving}>
            {saving ? 'Saving...' : 'Save Player Plan'}
          </button>
        </div>

        <div className="ui-card ui-col-8" style={{ minHeight: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Saved Plans</h3>
            <button
              type="button"
              className="ui-btn"
              onClick={async () => {
                setLoadingPlans(true);
                try {
                  await fetchPlayerTrainingPlans();
                } finally {
                  setLoadingPlans(false);
                }
              }}
            >
              Refresh
            </button>
          </div>

          {loadingPlans ? (
            <p>Loading saved plans...</p>
          ) : playerTrainingPlans.length === 0 ? (
            <EmptyState title="No saved player plans" description="Save a player plan and it will appear here for edit/delete." />
          ) : (
            <div className="ui-table-shell">
              <table className="ui-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Pos</th>
                    <th>Focus</th>
                    <th>Intensity</th>
                    <th className="ui-num">Form</th>
                    <th className="ui-num">OVR (B/C)</th>
                    <th className="ui-num">Fatigue</th>
                    <th>Updated</th>
                    <th className="ui-num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {playerTrainingPlans.map((plan) => (
                    <tr key={`${plan.saveId}-${plan.playerId}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{plan.player?.name || '--'}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{plan.player?.team?.shortName || '--'}</div>
                      </td>
                      <td>{plan.player?.pos || '--'}</td>
                      <td>{plan.focus}</td>
                      <td>{plan.intensity}</td>
                      <td className="ui-num">{plan.player?.form ?? '--'}</td>
                      <td className="ui-num">
                        {plan.player?.overallBase ?? '--'} / {plan.player?.overallCurrent ?? '--'}
                      </td>
                      <td className="ui-num">{plan.player?.fatigue ?? '--'}</td>
                      <td>{fmtDate(plan.updatedAt)}</td>
                      <td className="ui-num" style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="ui-btn" onClick={() => onEdit(plan)} style={{ marginRight: 8 }}>
                          Edit
                        </button>
                        <button type="button" className="ui-btn" onClick={() => onDelete(plan)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

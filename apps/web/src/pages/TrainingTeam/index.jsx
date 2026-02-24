import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';

export function TrainingTeam() {
  const { currentSave, saveTrainingConfig, fetchTrainingConfig } = useGameStore();
  const training = currentSave?.data?.training || {};
  const weekPlan = training.weekPlan || {};
  const [intensity, setIntensity] = useState(currentSave?.data?.trainingPlan?.intensity || 'balanced');
  const [focus, setFocus] = useState(currentSave?.data?.trainingPlan?.focus || 'balanced');
  const [restDay, setRestDay] = useState('Sun');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentSave?.id) return;
    fetchTrainingConfig();
  }, [currentSave?.id, fetchTrainingConfig]);

  useEffect(() => {
    setIntensity(currentSave?.data?.trainingPlan?.intensity || 'balanced');
    setFocus(currentSave?.data?.trainingPlan?.focus || 'balanced');
  }, [currentSave?.data?.trainingPlan?.intensity, currentSave?.data?.trainingPlan?.focus]);

  const previewWeekPlan = useMemo(() => ({
    ...weekPlan,
    [restDay]: { intensity: 'low', focus: 'fitness' },
  }), [weekPlan, restDay]);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveTrainingConfig({
        trainingPlan: { intensity, focus },
        weekPlan: previewWeekPlan,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="player-detail-page">
      <h2>Team Training</h2>
      <div className="player-info-card">
        <p><strong>Intensity</strong></p>
        <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
          <option value="low">Low</option>
          <option value="balanced">Balanced</option>
          <option value="high">High</option>
        </select>
        <p style={{ marginTop: 12 }}><strong>Focus</strong></p>
        <select value={focus} onChange={(e) => setFocus(e.target.value)}>
          <option value="balanced">Balanced</option>
          <option value="shooting">Shooting</option>
          <option value="defense">Defense</option>
          <option value="fitness">Conditioning</option>
        </select>
        <p style={{ marginTop: 12 }}><strong>Rest Day</strong></p>
        <select value={restDay} onChange={(e) => setRestDay(e.target.value)}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div style={{ marginTop: 16 }}>
          <button className="btn-small" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save Team Training'}</button>
        </div>
      </div>
    </div>
  );
}

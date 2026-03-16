import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui';
import { useGameStore } from '../../state/gameStore';
import './training-team.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABEL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const FOCUS_CARDS = [
  { id: 'offense', label: 'Offense', desc: 'Improve offensive plays and scoring', saveFocus: 'shooting' },
  { id: 'defense', label: 'Defense', desc: 'Enhance defensive capabilities', saveFocus: 'defense' },
  { id: 'shooting', label: 'Shooting', desc: 'Work on field goals and 3-pointers', saveFocus: 'shooting' },
  { id: 'rebounding', label: 'Rebounding', desc: 'Improve rebounding skills', saveFocus: 'balanced' },
  { id: 'conditioning', label: 'Conditioning', desc: 'Build stamina and fitness', saveFocus: 'fitness' },
  { id: 'tactics', label: 'Tactics', desc: 'Study plays and team coordination', saveFocus: 'playmaking' },
];

const PRESETS = [
  { id: 'playoff', name: 'Playoff Preparation', desc: 'High intensity, focus on tactics', primary: 'tactics', secondary: 'defense', intensity: 85, duration: 100 },
  { id: 'recovery', name: 'Recovery Mode', desc: 'Low intensity, conditioning focus', primary: 'conditioning', secondary: 'defense', intensity: 45, duration: 70 },
  { id: 'offense', name: 'Offensive Boost', desc: 'Shooting and offense training', primary: 'offense', secondary: 'shooting', intensity: 70, duration: 90 },
];

function toIntensityLabel(percent) {
  if (percent <= 45) return 'low';
  if (percent >= 75) return 'high';
  return 'balanced';
}

function fromStoredIntensity(intensity) {
  if (intensity === 'low') return 35;
  if (intensity === 'high') return 80;
  return 60;
}

function toPercentFromStored(row, fallback = 60) {
  const pct = Number(row?.intensityPercent);
  if (Number.isFinite(pct)) return Math.max(20, Math.min(100, pct));
  return fromStoredIntensity(row?.intensity);
}

function toDefaultDayPlans() {
  return Object.fromEntries(
    DAYS.map((day) => [day, { enabled: true, focusId: 'offense', intensity: 70, duration: 90 }]),
  );
}

export function TrainingTeam() {
  const { currentSave, saveTrainingConfig, fetchTrainingConfig } = useGameStore();
  const training = currentSave?.data?.training || {};
  const weekPlan = training.weekPlan || {};
  const [primaryFocus, setPrimaryFocus] = useState('offense');
  const [secondaryFocus, setSecondaryFocus] = useState('defense');
  const [intensity, setIntensity] = useState(70);
  const [duration, setDuration] = useState(90);
  const [dayPlans, setDayPlans] = useState(toDefaultDayPlans);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (currentSave?.id) fetchTrainingConfig(); }, [currentSave?.id, fetchTrainingConfig]);

  useEffect(() => {
    const storedPlan = currentSave?.data?.trainingPlan || {};
    const storedIntensity = storedPlan?.intensity || 'balanced';
    const storedPercent = Number(storedPlan?.intensityPercent);
    setIntensity(Number.isFinite(storedPercent) ? Math.max(20, Math.min(100, storedPercent)) : fromStoredIntensity(storedIntensity));
    const next = toDefaultDayPlans();
    for (const day of DAYS) {
      const row = weekPlan?.[day];
      if (!row) continue;
      const focusId = row.focus === 'defense'
        ? 'defense'
        : row.focus === 'fitness'
          ? 'conditioning'
          : row.focus === 'playmaking'
            ? 'tactics'
            : row.focus === 'balanced'
              ? 'rebounding'
              : 'offense';
      next[day] = {
        enabled: row.focus !== 'fitness' || row.intensity !== 'low',
        focusId,
        intensity: toPercentFromStored(row, 70),
        duration: Number.isFinite(row.durationMinutes) ? Number(row.durationMinutes) : 90,
      };
    }
    setDayPlans(next);
  }, [currentSave?.data?.trainingPlan?.intensity, currentSave?.data?.trainingPlan?.intensityPercent, weekPlan]);

  const impact = useMemo(() => {
    const skill = Math.round((intensity - 50) / 5);
    const fitness = Math.round((55 - intensity) / 6);
    const morale = intensity > 80 ? -1 : intensity > 65 ? 0 : 1;
    return { skill, fitness, morale };
  }, [intensity]);

  const summary = useMemo(() => ({
    primary: FOCUS_CARDS.find((f) => f.id === primaryFocus)?.label || 'Offense',
    secondary: FOCUS_CARDS.find((f) => f.id === secondaryFocus)?.label || 'Defense',
    intensity,
    duration,
  }), [primaryFocus, secondaryFocus, intensity, duration]);

  const applyPreset = (preset) => {
    setPrimaryFocus(preset.primary);
    setSecondaryFocus(preset.secondary);
    setIntensity(preset.intensity);
    setDuration(preset.duration);
    setDayPlans((prev) => {
      const next = { ...prev };
      for (const day of DAYS) {
        next[day] = { ...next[day], enabled: true, focusId: preset.primary, intensity: preset.intensity, duration: preset.duration };
      }
      return next;
    });
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const primary = FOCUS_CARDS.find((f) => f.id === primaryFocus);
      const trainingPlan = {
        intensity: toIntensityLabel(intensity),
        focus: primary?.saveFocus || 'balanced',
        intensityPercent: intensity,
      };
      const focusById = Object.fromEntries(FOCUS_CARDS.map((f) => [f.id, f.saveFocus]));
      const nextWeekPlan = {};
      for (const day of DAYS) {
        const dayConfig = dayPlans[day] || { enabled: true, focusId: primaryFocus, intensity, duration };
        nextWeekPlan[day] = dayConfig.enabled
          ? {
              intensity: toIntensityLabel(dayConfig.intensity),
              intensityPercent: Math.max(20, Math.min(100, Number(dayConfig.intensity) || 60)),
              focus: focusById[dayConfig.focusId] || primary?.saveFocus || 'balanced',
              durationMinutes: Math.max(30, Math.min(180, Number(dayConfig.duration) || 90)),
            }
          : { intensity: 'low', intensityPercent: 20, focus: 'fitness', durationMinutes: 45 };
      }
      await saveTrainingConfig({
        trainingPlan,
        weekPlan: { ...weekPlan, ...nextWeekPlan },
      });
    } finally {
      setSaving(false);
    }
  };

  const teamDayImpact = (focusId, intensityValue, enabled) => {
    if (!enabled) return { attack: 0, defense: 0, physicality: 0, stamina: 2, health: 2, morale: 1 };
    const i = Number(intensityValue ?? intensity);
    const attack = focusId === 'offense' || focusId === 'shooting' ? 2 : focusId === 'tactics' ? 1 : 0;
    const defense = focusId === 'defense' ? 2 : focusId === 'tactics' ? 1 : 0;
    const physicality = focusId === 'conditioning' || focusId === 'rebounding' ? 2 : i > 75 ? 1 : 0;
    const stamina = focusId === 'conditioning' ? 2 : i <= 45 ? 1 : -1;
    const health = i > 82 ? -2 : i > 70 ? -1 : i <= 45 ? 1 : 0;
    const morale = i > 85 ? -1 : i <= 50 ? 1 : 0;
    return { attack, defense, physicality, stamina, health, morale };
  };

  return (
    <div className="team-training-page">
      <PageHeader title="Team Training" subtitle="Set training focus and intensity for the entire team" />

      <div className="tt-grid">
        <section className="tt-card tt-main">
          <h3>Training Focus Areas</h3>
          <div className="tt-subhead">Primary Focus (60%)</div>
          <div className="tt-focus-grid">
            {FOCUS_CARDS.map((card) => (
              <button
                key={`primary-${card.id}`}
                type="button"
                className={`tt-focus-card ${primaryFocus === card.id ? 'is-active' : ''}`}
                onClick={() => setPrimaryFocus(card.id)}
              >
                <div>{card.label}</div>
                <small>{card.desc}</small>
              </button>
            ))}
          </div>
          <div className="tt-subhead">Secondary Focus (40%)</div>
          <div className="tt-focus-grid">
            {FOCUS_CARDS.map((card) => (
              <button
                key={`secondary-${card.id}`}
                type="button"
                className={`tt-focus-card secondary ${secondaryFocus === card.id ? 'is-active' : ''}`}
                onClick={() => setSecondaryFocus(card.id)}
              >
                <div>{card.label}</div>
                <small>{card.desc}</small>
              </button>
            ))}
          </div>
        </section>

        <aside className="tt-side">
          <section className="tt-card">
            <h3>Expected Impact</h3>
            <div className="tt-impact-row"><span>Skill Development</span><strong className="pos">{impact.skill >= 0 ? `+${impact.skill}` : impact.skill}%</strong></div>
            <div className="tt-impact-bar"><span style={{ width: `${Math.min(100, Math.max(8, 55 + impact.skill * 4))}%` }} /></div>
            <div className="tt-impact-row"><span>Fitness Change</span><strong className={impact.fitness >= 0 ? 'pos' : 'neg'}>{impact.fitness >= 0 ? `+${impact.fitness}` : impact.fitness}%</strong></div>
            <div className="tt-impact-bar"><span className={impact.fitness >= 0 ? '' : 'neg'} style={{ width: `${Math.min(100, Math.max(8, 35 + Math.abs(impact.fitness) * 8))}%` }} /></div>
            <div className="tt-impact-row"><span>Morale Change</span><strong className={impact.morale >= 0 ? 'pos' : 'neg'}>{impact.morale >= 0 ? `+${impact.morale}` : impact.morale}</strong></div>
            <div className="tt-impact-bar"><span style={{ width: `${Math.min(100, Math.max(8, 20 + Math.abs(impact.morale) * 18))}%` }} /></div>
          </section>

          <section className="tt-card">
            <h3>Training Plan Summary</h3>
            <div className="tt-summary-row"><span>Primary Focus:</span><strong>{summary.primary}</strong></div>
            <div className="tt-summary-row"><span>Secondary Focus:</span><strong>{summary.secondary}</strong></div>
            <div className="tt-summary-row"><span>Intensity:</span><strong>{summary.intensity}%</strong></div>
            <div className="tt-summary-row"><span>Duration:</span><strong>{summary.duration} min</strong></div>
            <button className="tt-primary-btn" type="button" onClick={savePlan} disabled={saving}>
              {saving ? 'Applying...' : 'Apply Training Plan'}
            </button>
          </section>

          <section className="tt-card">
            <h3>Quick Presets</h3>
            <div className="tt-presets">
              {PRESETS.map((preset) => (
                <button key={preset.id} type="button" className="tt-preset-item" onClick={() => applyPreset(preset)}>
                  <div>{preset.name}</div>
                  <small>{preset.desc}</small>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="tt-card">
        <h3>Training Parameters</h3>
        <div className="tt-slider-wrap">
          <div className="tt-slider-head"><span>Training Intensity</span><strong>{intensity}%</strong></div>
          <input type="range" min="20" max="100" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
          <div className="tt-slider-scale"><span>Light</span><span>Moderate</span><span>Intense</span></div>
        </div>
        <div className="tt-slider-wrap">
          <div className="tt-slider-head"><span>Session Duration</span><strong>{duration} minutes</strong></div>
          <input type="range" min="30" max="180" step="5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          <div className="tt-slider-scale"><span>30 min</span><span>90 min</span><span>180 min</span></div>
        </div>
      </section>

      <section className="tt-card">
        <h3>Weekly Schedule (Saved To DB)</h3>
        <div className="tt-week-list">
          {DAYS.map((day) => {
            const cfg = dayPlans[day] || { enabled: true, focusId: primaryFocus, intensity, duration };
            return (
              <div key={day} className="tt-week-row">
                <div className="tt-week-left">
                  <input type="checkbox" checked={cfg.enabled} onChange={(e) => setDayPlans((prev) => ({ ...prev, [day]: { ...(prev[day] || {}), enabled: e.target.checked } }))} />
                  <div>
                    <strong>{DAY_LABEL[day]}</strong>
                    <small>{cfg.enabled ? 'Custom day plan' : 'Rest Day'}</small>
                  </div>
                </div>
                <div className="tt-week-controls">
                  <select
                    className="tt-week-select"
                    value={cfg.focusId}
                    disabled={!cfg.enabled}
                    onChange={(e) => setDayPlans((prev) => ({ ...prev, [day]: { ...(prev[day] || {}), focusId: e.target.value } }))}
                  >
                    {FOCUS_CARDS.map((focus) => <option key={`${day}-${focus.id}`} value={focus.id}>{focus.label}</option>)}
                  </select>
                  <input
                    className="tt-week-range"
                    type="range"
                    min="20"
                    max="100"
                    value={cfg.intensity}
                    disabled={!cfg.enabled}
                    onChange={(e) => setDayPlans((prev) => ({ ...prev, [day]: { ...(prev[day] || {}), intensity: Number(e.target.value) } }))}
                  />
                  <input
                    className="tt-week-number"
                    type="number"
                    min="30"
                    max="180"
                    value={cfg.duration}
                    disabled={!cfg.enabled}
                    onChange={(e) => setDayPlans((prev) => ({ ...prev, [day]: { ...(prev[day] || {}), duration: Number(e.target.value) } }))}
                  />
                  <span className="tt-pill">{cfg.enabled ? `${cfg.intensity}%` : 'Rest'}</span>
                  <small className="tt-week-impact">
                    {(() => {
                      const eff = teamDayImpact(cfg.focusId, cfg.intensity, cfg.enabled);
                      return `ATT ${eff.attack >= 0 ? '+' : ''}${eff.attack} | DEF ${eff.defense >= 0 ? '+' : ''}${eff.defense} | PHY ${eff.physicality >= 0 ? '+' : ''}${eff.physicality} | STA ${eff.stamina >= 0 ? '+' : ''}${eff.stamina} | HLT ${eff.health >= 0 ? '+' : ''}${eff.health} | MOR ${eff.morale >= 0 ? '+' : ''}${eff.morale}`;
                    })()}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
        <button className="tt-primary-btn full" type="button" onClick={savePlan} disabled={saving}>
          {saving ? 'Saving...' : 'Save Training Plan'}
        </button>
      </section>
    </div>
  );
}

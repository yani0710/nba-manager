import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui';
import { useGameStore } from '../../state/gameStore';
import { api } from '../../api/client';
import './training-players.css';

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const FOCUS_OPTIONS = [
  { key: 'shooting', label: 'Shooting', apiFocus: 'SHOOTING', saveFocus: 'shooting' },
  { key: 'defense', label: 'Defense', apiFocus: 'DEFENSE', saveFocus: 'defense' },
  { key: 'passing', label: 'Passing', apiFocus: 'PLAYMAKING', saveFocus: 'playmaking' },
  { key: 'dribbling', label: 'Dribbling', apiFocus: 'PLAYMAKING', saveFocus: 'playmaking' },
  { key: 'athleticism', label: 'Athleticism', apiFocus: 'CONDITIONING', saveFocus: 'fitness' },
  { key: 'bbiq', label: 'BBIQ', apiFocus: 'BALANCED', saveFocus: 'balanced' },
];

function toApiIntensity(percent) {
  if (percent <= 45) return 'LOW';
  if (percent >= 75) return 'HIGH';
  return 'BALANCED';
}

function toSaveIntensity(percent) {
  if (percent <= 45) return 'low';
  if (percent >= 75) return 'high';
  return 'balanced';
}

function fromStoredIntensityWithPercent(value, percentValue, fallback = 60) {
  const pct = Number(percentValue);
  if (Number.isFinite(pct)) return Math.max(20, Math.min(100, pct));
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(20, Math.min(100, value));
  if (value === 'low' || value === 'LOW') return 35;
  if (value === 'high' || value === 'HIGH') return 80;
  if (value === 'balanced' || value === 'BALANCED') return 60;
  return fallback;
}

function getInitials(name) {
  return String(name || '').split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'NA';
}

function toSafeNumber(value, fallback = 70) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickAttr(attrs, keys, fallback) {
  for (const key of keys) {
    const raw = attrs?.[key];
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function deriveMetrics(player) {
  const attrs = (player?.attributes && typeof player.attributes === 'object') ? player.attributes : {};
  const shooting3 = pickAttr(attrs, ['shooting3', 'shooting', 'att'], toSafeNumber(player?.fg3Pct, 0) * 100 || 70);
  const shootingMid = pickAttr(attrs, ['shootingMid', 'shooting', 'att'], toSafeNumber(player?.fgPct, 0) * 100 || 70);
  const offense = toSafeNumber(player?.offensiveRating, 70);
  const shooting = Math.round((shooting3 + shootingMid + offense) / 3);
  const defense = pickAttr(attrs, ['defense', 'def'], toSafeNumber(player?.defensiveRating, 70));
  const passing = pickAttr(attrs, ['playmaking', 'play'], toSafeNumber(player?.iqRating, 70));
  const athleticism = pickAttr(attrs, ['athleticism', 'phy'], toSafeNumber(player?.physicalRating, 70));
  const dribbling = Math.round((passing * 0.9) + (athleticism * 0.1));
  const bbiq = pickAttr(attrs, ['iq', 'bbiq'], toSafeNumber(player?.iqRating, 70));
  const clamp = (value) => Math.min(99, Math.max(40, Math.round(value)));
  return {
    shooting: clamp(shooting),
    defense: clamp(defense),
    passing: clamp(passing),
    dribbling: clamp(dribbling),
    athleticism: clamp(athleticism),
    bbiq: clamp(bbiq),
  };
}

export function TrainingPlayers() {
  const {
    currentSave,
    squadPlayers,
    playerTrainingPlans,
    saveTrainingConfig,
    fetchSquad,
    fetchPlayerTrainingPlans,
    upsertPlayerTrainingPlan,
  } = useGameStore();

  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState(null);
  const [focusKey, setFocusKey] = useState('shooting');
  const [intensity, setIntensity] = useState(60);
  const [dayPlan, setDayPlan] = useState(() => Object.fromEntries(
    DAY_KEYS.map((day) => [day, { intensity: 60, focusKey: 'shooting' }]),
  ));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      await fetchSquad();
      await fetchPlayerTrainingPlans();
    })();
  }, [fetchSquad, fetchPlayerTrainingPlans, currentSave?.id]);

  useEffect(() => {
    if (!selectedPlayerId && squadPlayers?.length) {
      setSelectedPlayerId(squadPlayers[0].id);
    }
  }, [selectedPlayerId, squadPlayers]);

  const selectedPlayer = useMemo(
    () => (squadPlayers || []).find((player) => player.id === selectedPlayerId) || null,
    [squadPlayers, selectedPlayerId],
  );

  useEffect(() => {
    let active = true;
    if (!selectedPlayerId) {
      setSelectedPlayerDetails(null);
      return () => { active = false; };
    }
    (async () => {
      try {
        const saveParams = currentSave?.id ? { saveId: currentSave.id } : {};
        const { data } = await api.players.getById(selectedPlayerId, saveParams);
        if (active) setSelectedPlayerDetails(data);
      } catch {
        if (active) setSelectedPlayerDetails(null);
      }
    })();
    return () => { active = false; };
  }, [selectedPlayerId, currentSave?.id]);

  useEffect(() => {
    if (!selectedPlayer) return;
    const existing = (playerTrainingPlans || []).find((plan) => Number(plan.playerId) === Number(selectedPlayer.id));
    const savedFromJson = currentSave?.data?.training?.playerPlans?.[String(selectedPlayer.id)];
    if (existing) {
      if (existing.focus === 'SHOOTING') setFocusKey('shooting');
      else if (existing.focus === 'DEFENSE') setFocusKey('defense');
      else if (existing.focus === 'PLAYMAKING') setFocusKey('passing');
      else if (existing.focus === 'CONDITIONING') setFocusKey('athleticism');
      else setFocusKey('bbiq');
      setIntensity(fromStoredIntensityWithPercent(existing.intensity, savedFromJson?.intensityPercent, 60));
    } else {
      setFocusKey('shooting');
      setIntensity(60);
    }
    const storedPlan = existing?.dayPlan
      ? { dayPlan: existing.dayPlan }
      : currentSave?.data?.training?.playerPlans?.[String(selectedPlayer.id)];
    const mappedDefaultFocus = existing?.focus === 'DEFENSE' ? 'defense' : existing?.focus === 'PLAYMAKING' ? 'passing' : existing?.focus === 'CONDITIONING' ? 'athleticism' : 'shooting';
    const nextDayPlan = Object.fromEntries(
      DAY_KEYS.map((day) => [day, { intensity: 60, focusKey: mappedDefaultFocus }]),
    );
    if (storedPlan?.dayPlan && typeof storedPlan.dayPlan === 'object') {
      for (const day of DAY_KEYS) {
        const row = storedPlan.dayPlan[day];
        if (!row) continue;
        const mappedFocus = typeof row.focusKey === 'string'
          ? row.focusKey
          : row.focus === 'defense'
            ? 'defense'
            : row.focus === 'fitness'
              ? 'athleticism'
              : row.focus === 'playmaking'
                ? 'passing'
                : row.focus === 'balanced'
                  ? 'bbiq'
                  : 'shooting';
        nextDayPlan[day] = {
          intensity: fromStoredIntensityWithPercent(row.intensity, row.intensityPercent, 60),
          focusKey: mappedFocus,
        };
      }
    }
    setDayPlan(nextDayPlan);
  }, [selectedPlayer, playerTrainingPlans, currentSave?.data?.training?.playerPlans]);

  const metrics = deriveMetrics(selectedPlayerDetails || selectedPlayer);
  const selectedFocus = FOCUS_OPTIONS.find((item) => item.key === focusKey) || FOCUS_OPTIONS[0];

  const realStats = useMemo(() => {
    const player = selectedPlayerDetails || selectedPlayer;
    if (!player) return [];
    const pairs = [
      ['Career Games', player.gamesCareer],
      ['Career PTS', player.ptsCareer],
      ['Career REB', player.trbCareer],
      ['Career AST', player.astCareer],
      ['FG%', player.fgPct],
      ['3P%', player.fg3Pct],
      ['FT%', player.ftPct],
      ['PER', player.per],
      ['WS', player.ws],
      ['eFG%', player.efgPct],
      ['Salary', player.salary ? `$${Math.round(player.salary / 1_000_000)}M` : '--'],
    ];
    return pairs
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([label, value]) => {
        if (typeof value === 'number') {
          const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
          return { label, value: formatted };
        }
        return { label, value: String(value) };
      });
  }, [selectedPlayer, selectedPlayerDetails]);

  const dayImpact = (focusValue, intensityValue) => {
    const i = Number(intensityValue ?? intensity);
    const attack = focusValue === 'shooting' ? 2 : focusValue === 'passing' || focusValue === 'dribbling' ? 1 : 0;
    const defense = focusValue === 'defense' ? 2 : 0;
    const physicality = focusValue === 'athleticism' ? 2 : i > 75 ? 1 : 0;
    const stamina = focusValue === 'athleticism' ? 2 : i <= 45 ? 1 : -1;
    const health = i > 82 ? -2 : i > 70 ? -1 : i <= 45 ? 1 : 0;
    const morale = i > 85 ? -1 : i <= 50 ? 1 : 0;
    return { attack, defense, physicality, stamina, health, morale };
  };

  const savePlan = async () => {
    if (!selectedPlayer) return;
    setSaving(true);
    try {
      await upsertPlayerTrainingPlan({
        playerId: selectedPlayer.id,
        focus: selectedFocus.apiFocus,
        intensity: toApiIntensity(intensity),
        dayPlan: Object.fromEntries(
          DAY_KEYS.map((day) => [day, {
            intensity: toSaveIntensity(dayPlan[day]?.intensity ?? intensity),
            intensityPercent: Number(dayPlan[day]?.intensity ?? intensity),
            focus: Object.fromEntries(FOCUS_OPTIONS.map((option) => [option.key, option.saveFocus]))[dayPlan[day]?.focusKey] || selectedFocus.saveFocus,
            focusKey: dayPlan[day]?.focusKey || focusKey,
          }]),
        ),
      });

      const focusMap = Object.fromEntries(FOCUS_OPTIONS.map((option) => [option.key, option.saveFocus]));
      const dayPlanPayload = Object.fromEntries(
        DAY_KEYS.map((day) => [day, {
          intensity: toSaveIntensity(dayPlan[day]?.intensity ?? intensity),
          intensityPercent: Number(dayPlan[day]?.intensity ?? intensity),
          focus: focusMap[dayPlan[day]?.focusKey] || selectedFocus.saveFocus,
          focusKey: dayPlan[day]?.focusKey || focusKey,
        }]),
      );

      await saveTrainingConfig({
        playerPlans: {
          [String(selectedPlayer.id)]: {
            intensity: toSaveIntensity(intensity),
            intensityPercent: intensity,
            focus: selectedFocus.saveFocus,
            dayPlan: dayPlanPayload,
          },
        },
      });
      await fetchPlayerTrainingPlans();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="player-training-page">
      <PageHeader title="Player Training" subtitle="Customize individual training programs for each player" />
      <div className="pt-grid">
        <aside className="pt-sidebar">
          <section className="pt-card">
            <h3>Select Player</h3>
            <div className="pt-player-list">
              {(squadPlayers || []).map((player) => {
                const isActive = player.id === selectedPlayerId;
                return (
                  <button
                    key={player.id}
                    type="button"
                    className={`pt-player-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => setSelectedPlayerId(player.id)}
                  >
                    <div className="pt-avatar">{getInitials(player.name)}</div>
                    <div>
                      <div className="pt-player-name">{player.name}</div>
                      <small>{player.position || 'N/A'} | OVR {player.overallCurrent ?? player.overall ?? '--'} | POT {player.potential ?? '--'}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <main className="pt-main">
          {!selectedPlayer ? null : (
            <>
              <section className="pt-card">
                <div className="pt-header-row">
                  <div className="pt-header-player">
                    <div className="pt-avatar big">{getInitials(selectedPlayer.name)}</div>
                    <div>
                      <h2>{selectedPlayer.name}</h2>
                      <p>#{selectedPlayer.jerseyNumber ?? selectedPlayer.number ?? '--'} | {selectedPlayer.position || 'N/A'} | {selectedPlayer.age ?? '--'} years old</p>
                    </div>
                  </div>
                  <div className="pt-overall">
                    <div>{selectedPlayer.overallCurrent ?? selectedPlayer.overall ?? '--'}</div>
                    <small>Overall Rating</small>
                    <strong>Potential: {selectedPlayer.potential ?? '--'}</strong>
                  </div>
                </div>
                <div className="pt-metrics-grid">
                  {[
                    ['Shooting', metrics.shooting],
                    ['Defense', metrics.defense],
                    ['Passing', metrics.passing],
                    ['Dribbling', metrics.dribbling],
                    ['Athleticism', metrics.athleticism],
                    ['Bbiq', metrics.bbiq],
                  ].map(([label, value]) => (
                    <div key={label} className="pt-metric-card">
                      <span>{label}</span>
                      <div className="pt-metric-bar"><span style={{ width: `${value}%` }} /></div>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="pt-real-stats-grid">
                  {realStats.map((stat) => (
                    <div key={stat.label} className="pt-real-stat">
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pt-card">
                <h3>Training Focus</h3>
                <div className="pt-focus-grid">
                  {FOCUS_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`pt-focus-card ${focusKey === option.key ? 'is-active' : ''}`}
                      onClick={() => setFocusKey(option.key)}
                    >
                      <div>{option.label}</div>
                      <strong>{metrics[option.key]}</strong>
                    </button>
                  ))}
                </div>

                <div className="pt-slider-wrap">
                  <div className="pt-slider-head"><span>Training Intensity</span><strong>{intensity}%</strong></div>
                  <input type="range" min="20" max="100" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
                  <div className="pt-slider-scale"><span>Light</span><span>Moderate</span><span>Intense</span></div>
                </div>

                <div className="pt-impact-box">
                  <div className="pt-impact-title">Expected Weekly Improvement</div>
                  <ul>
                    <li>{selectedFocus.label} will improve by approximately {Math.max(0, Math.round((intensity - 55) / 8))} points per week</li>
                    <li>Fitness impact: {intensity > 80 ? '-1%' : '0%'}</li>
                    <li>Morale: Excellent</li>
                  </ul>
                  <strong>+{Math.max(0, Math.round((intensity - 50) / 10))}</strong>
                </div>
              </section>

              <section className="pt-card">
                <h3>Weekly Training Schedule (Per Player)</h3>
                <div className="pt-week-list">
                  {DAY_KEYS.map((day) => (
                    <label key={day} className="pt-week-row">
                      <div className="pt-week-meta">
                        <strong>{DAY_LABELS[day]}</strong>
                        <small>{(FOCUS_OPTIONS.find((option) => option.key === (dayPlan[day]?.focusKey || focusKey)) || selectedFocus).label} Training</small>
                      </div>
                      <div className="pt-week-controls">
                        <select
                          className="pt-week-select"
                          value={dayPlan[day]?.focusKey || focusKey}
                          onChange={(e) => setDayPlan((prev) => ({ ...prev, [day]: { ...(prev[day] || {}), focusKey: e.target.value } }))}
                        >
                          {FOCUS_OPTIONS.map((option) => <option key={`${day}-${option.key}`} value={option.key}>{option.label}</option>)}
                        </select>
                        <input
                          className="pt-week-range"
                          type="range"
                          min="20"
                          max="100"
                          value={dayPlan[day]?.intensity ?? intensity}
                          onChange={(e) => setDayPlan((prev) => ({ ...prev, [day]: { ...(prev[day] || {}), intensity: Number(e.target.value) } }))}
                        />
                        <span>{dayPlan[day]?.intensity ?? intensity}%</span>
                        <small className="pt-week-impact">
                          {(() => {
                            const eff = dayImpact(dayPlan[day]?.focusKey || focusKey, dayPlan[day]?.intensity ?? intensity);
                            return `ATT ${eff.attack >= 0 ? '+' : ''}${eff.attack} | DEF ${eff.defense >= 0 ? '+' : ''}${eff.defense} | PHY ${eff.physicality >= 0 ? '+' : ''}${eff.physicality} | STA ${eff.stamina >= 0 ? '+' : ''}${eff.stamina} | HLT ${eff.health >= 0 ? '+' : ''}${eff.health} | MOR ${eff.morale >= 0 ? '+' : ''}${eff.morale}`;
                          })()}
                        </small>
                      </div>
                    </label>
                  ))}
                </div>
                <button className="pt-primary-btn" type="button" onClick={savePlan} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Player Plan'}
                </button>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

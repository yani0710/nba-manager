import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui';
import { api } from '../../api/client';
import { useGameStore } from '../../state/gameStore';
import './training-players.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const TABS = ['individual', 'schedule', 'reports'];
const INTENSITY = { very_light: 28, light: 42, medium: 58, high: 76, very_high: 90 };
const ROLES = [
  ['Primary Ball Handler', 'PLAYMAKING'], ['Shot Creator', 'SHOOTING'], ['3-and-D Wing', 'DEFENSE'], ['Defensive Anchor', 'DEFENSE'],
  ['Stretch Four', 'SHOOTING'], ['Bench Playmaker', 'PLAYMAKING'], ['Two-Way Star', 'BALANCED'],
];
const EXTRA = [
  ['Shooting', 'SHOOTING'], ['Finishing', 'SHOOTING'], ['Passing', 'PLAYMAKING'], ['Ball Handling', 'PLAYMAKING'],
  ['Perimeter Defense', 'DEFENSE'], ['Interior Defense', 'DEFENSE'], ['Rebounding', 'DEFENSE'],
  ['Conditioning', 'CONDITIONING'], ['Strength', 'CONDITIONING'], ['Basketball IQ', 'BALANCED'],
];
const TYPES = [
  ['Shooting', 'SHOOTING', [2, 0, 0, 0, 1, 0]], ['Passing / Playmaking', 'PLAYMAKING', [0, 2, 0, 0, 1, 0]],
  ['Perimeter Defense', 'DEFENSE', [0, 0, 2, 1, 1, 0]], ['Conditioning', 'CONDITIONING', [0, 0, 0, 2, 2, 1]],
  ['Film Study', 'BALANCED', [0, 1, 1, 0, -1, -1]], ['Recovery', 'CONDITIONING', [0, 0, 0, 1, -2, -2]], ['Rest Day', 'BALANCED', [0, 0, 0, 0, -3, -2]],
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const initials = (name) => String(name || '').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'NA';
const pos = (p) => { const u = String(p || '').toUpperCase(); if (u.includes('PG')) return 'PG'; if (u.includes('SG')) return 'SG'; if (u.includes('SF')) return 'SF'; if (u.includes('PF')) return 'PF'; if (u.includes('C')) return 'C'; return 'N/A'; };
const group = (p) => (['PG', 'SG'].includes(p) ? 'guards' : ['SF', 'PF'].includes(p) ? 'wings' : p === 'C' ? 'bigs' : 'all');
const intensityTier = (p) => (p <= 45 ? 'LOW' : p >= 75 ? 'HIGH' : 'BALANCED');
const saveFocus = (bucket) => ({ SHOOTING: 'shooting', DEFENSE: 'defense', PLAYMAKING: 'playmaking', CONDITIONING: 'fitness', BALANCED: 'balanced' }[bucket] || 'balanced');
const focusKey = (bucket) => ({ DEFENSE: 'defense', PLAYMAKING: 'passing', CONDITIONING: 'athleticism', BALANCED: 'bbiq', SHOOTING: 'shooting' }[bucket] || 'shooting');
const defaultDayPlan = () => Object.fromEntries(DAYS.map((d, i) => [d, { trainingType: i === 3 || i === 6 ? 'Recovery' : 'Shooting', intensityPercent: i === 3 || i === 6 ? 38 : 62 }]));

function attrs(player) {
  if (!player) return { shooting: 70, passing: 70, defense: 70, stamina: 70, potential: 75, three: 70, finish: 70, iq: 70 };
  const a = player.attributes && typeof player.attributes === 'object' ? player.attributes : {};
  const shooting = clamp(Math.round(((num(a.shooting3, num(player.fg3Pct, 0.35) * 100) + num(a.shootingMid, num(player.fgPct, 0.47) * 100) + num(player.offensiveRating, 70)) / 3)), 40, 99);
  return {
    shooting,
    three: clamp(Math.round(num(a.shooting3, num(player.fg3Pct, 0.35) * 100)), 40, 99),
    finish: clamp(Math.round(num(a.finishing, num(player.offensiveRating, 70))), 40, 99),
    passing: clamp(Math.round(num(a.playmaking, num(player.iqRating, 70))), 40, 99),
    defense: clamp(Math.round(num(a.defense, num(player.defensiveRating, 70))), 40, 99),
    stamina: clamp(Math.round(num(a.stamina, 78 - num(player.fatigue, 10) / 2)), 40, 99),
    iq: clamp(Math.round(num(a.iq, num(player.iqRating, 70))), 40, 99),
    potential: clamp(Math.round(num(player.potential, 75)), 40, 99),
  };
}

export function TrainingPlayers() {
  const { currentSave, squadPlayers, scheduleGames, playerTrainingPlans, fetchSquad, fetchSchedule, fetchPlayerTrainingPlans, saveTrainingConfig, upsertPlayerTrainingPlan } = useGameStore();
  const [tab, setTab] = useState('individual');
  const [playerId, setPlayerId] = useState(null);
  const [details, setDetails] = useState(null);
  const [q, setQ] = useState('');
  const [gFilter, setGFilter] = useState('all');
  const [role, setRole] = useState('Primary Ball Handler');
  const [extra, setExtra] = useState('Shooting');
  const [trainPos, setTrainPos] = useState('PG');
  const [level, setLevel] = useState('medium');
  const [days, setDays] = useState(defaultDayPlan);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { if (currentSave?.id) { fetchSquad(); fetchSchedule(); fetchPlayerTrainingPlans(); } }, [currentSave?.id, fetchSquad, fetchSchedule, fetchPlayerTrainingPlans]);
  useEffect(() => { if (!playerId && squadPlayers?.length) setPlayerId(squadPlayers[0].id); }, [playerId, squadPlayers]);

  const players = useMemo(() => (squadPlayers || []).map((p) => {
    const st = currentSave?.data?.playerState?.[String(p.id)] || {};
    const fatigue = num(st.fatigue, p.fatigue ?? 10);
    const pPos = pos(p.position || p.primaryPosition);
    return { ...p, pPos, g: group(pPos), ovr: num(p.overallCurrent ?? p.overall, 65), pot: num(p.potential, 75), fatigue, age: num(p.age, 25) };
  }), [currentSave?.data?.playerState, squadPlayers]);

  const filtered = useMemo(() => players.filter((p) => (gFilter === 'all' || p.g === gFilter) && String(p.name || '').toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.ovr - a.ovr), [players, gFilter, q]);
  const player = useMemo(() => filtered.find((p) => Number(p.id) === Number(playerId)) || players.find((p) => Number(p.id) === Number(playerId)) || null, [filtered, playerId, players]);

  useEffect(() => {
    if (!player) return;
    const fromJson = currentSave?.data?.training?.playerPlans?.[String(player.id)] || {};
    const fromDb = (playerTrainingPlans || []).find((p) => Number(p.playerId) === Number(player.id));
    setTrainPos(fromJson.trainingPosition || player.pPos || 'PG');
    setRole(fromJson.roleFocus || 'Primary Ball Handler');
    setExtra(fromJson.additionalFocus || 'Shooting');
    setLevel(Object.entries(INTENSITY).sort((a, b) => Math.abs((fromJson.intensityPercent ?? 58) - a[1]) - Math.abs((fromJson.intensityPercent ?? 58) - b[1]))[0][0]);
    const next = defaultDayPlan();
    const incoming = fromJson.dayPlan || fromDb?.dayPlan || {};
    for (const d of DAYS) {
      const row = incoming[d] || {};
      next[d] = { trainingType: row.trainingType || next[d].trainingType, intensityPercent: clamp(num(row.intensityPercent ?? row.intensity, next[d].intensityPercent), 20, 100) };
    }
    setDays(next);
  }, [player, currentSave?.data?.training?.playerPlans, playerTrainingPlans]);

  useEffect(() => {
    let active = true;
    if (!playerId) return undefined;
    (async () => { try { const { data } = await api.players.getById(playerId, currentSave?.id ? { saveId: currentSave.id } : {}); if (active) setDetails(data); } catch { if (active) setDetails(null); } })();
    return () => { active = false; };
  }, [playerId, currentSave?.id]);

  const metric = useMemo(() => attrs(details || player), [details, player]);
  const roleBucket = ROLES.find((r) => r[0] === role)?.[1] || 'BALANCED';
  const extraBucket = EXTRA.find((e) => e[0] === extra)?.[1] || roleBucket;
  const focusBucket = extraBucket || roleBucket;
  const avgIntensity = useMemo(() => Math.round(DAYS.reduce((s, d) => s + num(days[d]?.intensityPercent, INTENSITY[level]), 0) / 7), [days, level]);
  const workload = avgIntensity < 45 ? 'Light' : avgIntensity < 72 ? 'Medium' : 'Heavy';

  const gameDays = useMemo(() => {
    const out = {};
    const teamId = currentSave?.teamId;
    if (!teamId || !currentSave?.data?.currentDate) return out;
    const start = new Date(`${currentSave.data.currentDate}T00:00:00.000Z`);
    const keys = new Set((scheduleGames || []).filter((g) => ['scheduled', 'ready', 'live'].includes(String(g.status || '').toLowerCase()) && (Number(g.homeTeamId) === Number(teamId) || Number(g.awayTeamId) === Number(teamId))).map((g) => {
      const dt = new Date(g.gameDate); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    }));
    DAYS.forEach((d, i) => { const dt = new Date(start); dt.setUTCDate(start.getUTCDate() + i); const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`; out[d] = keys.has(key); });
    return out;
  }, [currentSave?.data?.currentDate, currentSave?.teamId, scheduleGames]);

  const totals = useMemo(() => DAYS.reduce((acc, d) => {
    const row = days[d] || {};
    const type = TYPES.find((t) => t[0] === row.trainingType) || TYPES[0];
    const mul = clamp(num(row.intensityPercent, 58), 20, 100) / 60;
    acc.s += type[2][0] * mul; acc.p += type[2][1] * mul; acc.d += type[2][2] * mul; acc.c += type[2][3] * mul; acc.f += type[2][4] * mul; acc.r += type[2][5] * mul;
    return acc;
  }, { s: 0, p: 0, d: 0, c: 0, f: 0, r: 0 }), [days]);

  const save = async () => {
    if (!player) return;
    setSaving(true);
    try {
      const p = INTENSITY[level] || 58;
      const dayPayload = Object.fromEntries(DAYS.map((d) => {
        const row = days[d] || {}; const type = TYPES.find((t) => t[0] === row.trainingType) || TYPES[0]; const ip = clamp(num(row.intensityPercent, p), 20, 100);
        return [d, { trainingType: type[0], focus: saveFocus(type[1]), focusKey: focusKey(type[1]), intensity: intensityTier(ip).toLowerCase(), intensityPercent: ip, durationMinutes: 90 }];
      }));
      await upsertPlayerTrainingPlan({ playerId: player.id, focus: focusBucket, intensity: intensityTier(p), dayPlan: dayPayload });
      await saveTrainingConfig({ playerPlans: { [String(player.id)]: { trainingPosition: trainPos, roleFocus: role, additionalFocus: extra, focus: saveFocus(focusBucket), intensity: intensityTier(p).toLowerCase(), intensityPercent: p, dayPlan: dayPayload } } });
      await fetchPlayerTrainingPlans();
      setMsg('Training plan saved.');
    } finally { setSaving(false); }
  };

  const autoCoach = () => {
    if (!player) return;
    const map = { PG: ['Primary Ball Handler', 'Passing', 'PG'], SG: ['Shot Creator', 'Shooting', 'SG'], SF: ['3-and-D Wing', 'Perimeter Defense', 'Wing'], PF: ['Stretch Four', 'Rebounding', 'PF'], C: ['Defensive Anchor', 'Interior Defense', 'C'] };
    const rec = map[player.pPos] || ['Two-Way Star', 'Basketball IQ', 'Wing'];
    setRole(rec[0]); setExtra(rec[1]); setTrainPos(rec[2]); setMsg('Auto-assigned by development coach.');
  };

  const reset = () => { if (!player) return; setRole('Primary Ball Handler'); setExtra('Shooting'); setTrainPos(player.pPos || 'PG'); setLevel('medium'); setDays(defaultDayPlan()); setMsg('Plan reset to default.'); };
  const copyMon = () => { const m = days.Mon || { trainingType: 'Shooting', intensityPercent: 58 }; setDays(Object.fromEntries(DAYS.map((d) => [d, { ...m }]))); };
  const syncGames = () => setDays((prev) => Object.fromEntries(DAYS.map((d) => [d, gameDays[d] ? { trainingType: 'Recovery', intensityPercent: 34 } : prev[d] || { trainingType: 'Shooting', intensityPercent: 58 }])));

  const report = useMemo(() => {
    if (!player) return null;
    const st = currentSave?.data?.playerState?.[String(player.id)] || {};
    const hist = Array.isArray(st.formHistory) ? st.formHistory : [];
    const avg7 = hist.slice(-7).reduce((s, v) => s + v, 0) / Math.max(1, hist.slice(-7).length || 1);
    const avg30 = hist.slice(-30).reduce((s, v) => s + v, 0) / Math.max(1, hist.slice(-30).length || 1);
    return { fatigue: num(st.fatigue, player.fatigue), morale: num(st.morale, 60), form: num(st.form, 65), avg7: Number(avg7 || num(st.form, 65)).toFixed(1), avg30: Number(avg30 || num(st.form, 65)).toFixed(1) };
  }, [currentSave?.data?.playerState, player]);

  return (
    <div className='ptv2-page'>
      <PageHeader title='Player Training' subtitle='Basketball player development and load management' />
      <section className='ptv2-top'><div><h1>Training Command Center</h1><p>{player ? `${player.name} | #${player.jerseyCode ?? player.jerseyNumber ?? player.number ?? '--'} | ${player.pPos}` : 'Select a player'}</p></div><div className='ptv2-rating'><span>Training Rating</span><strong>{num(currentSave?.data?.training?.rating, 74).toFixed(2)}</strong></div></section>
      <div className='ptv2-tabs'>{TABS.map((t) => <button key={t} type='button' className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>

      <div className='ptv2-grid'>
        <aside className='ptv2-card'>
          <h3>Training Squad</h3>
          <div className='ptv2-filters'>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search player' />
            <select value={gFilter} onChange={(e) => setGFilter(e.target.value)}><option value='all'>All Groups</option><option value='guards'>Guards</option><option value='wings'>Wings</option><option value='bigs'>Bigs</option></select>
          </div>
          <div className='ptv2-list'>{filtered.map((p) => <button key={p.id} type='button' className={Number(playerId) === Number(p.id) ? 'row active' : 'row'} onClick={() => setPlayerId(p.id)}><span>#{p.jerseyCode ?? p.jerseyNumber ?? p.number ?? '--'}</span><div><strong>{p.name}</strong><small>{p.pPos} | OVR {p.ovr} | POT {p.pot}</small></div></button>)}</div>
        </aside>

        <main className='ptv2-main'>
          {!player ? <section className='ptv2-card'><p>Select a player to begin.</p></section> : null}
          {player && tab === 'individual' ? (
            <section className='ptv2-card'>
              <div className='ptv2-header'><div className='av'>{initials(player.name)}</div><div><h2>{player.name}</h2><p>#{player.jerseyCode ?? player.jerseyNumber ?? player.number ?? '--'} | Age {player.age} | {player.pPos}</p></div></div>
              <div className='ptv2-form'>
                <label><span>Training Position</span><select value={trainPos} onChange={(e) => setTrainPos(e.target.value)}>{['PG', 'SG', 'SF', 'PF', 'C', 'Combo Guard', 'Wing', 'Forward', 'Big', 'Point Forward', 'Stretch Big', 'Small Ball 5'].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
                <label><span>Role Focus</span><select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r[0]} value={r[0]}>{r[0]}</option>)}</select></label>
                <label><span>Additional Focus</span><select value={extra} onChange={(e) => setExtra(e.target.value)}>{EXTRA.map((r) => <option key={r[0]} value={r[0]}>{r[0]}</option>)}</select></label>
                <label><span>Intensity Level</span><select value={level} onChange={(e) => { setLevel(e.target.value); DAYS.forEach((d) => setDays((prev) => ({ ...prev, [d]: { ...(prev[d] || {}), intensityPercent: INTENSITY[e.target.value] || 58 } }))); }}>{Object.keys(INTENSITY).map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}</select></label>
              </div>
              <div className='ptv2-work'><div><span>Workload</span><strong>{workload}</strong></div><div><span>Average Intensity</span><strong>{avgIntensity}%</strong></div><div><span>Projected Growth</span><strong>+{Math.max(0, ((player.pot - player.ovr) / 20) * (avgIntensity / 60)).toFixed(2)}</strong></div></div>
              <div className='ptv2-court'><div className='marker'>{trainPos}</div></div>
              <div className='ptv2-actions'><button type='button' className='primary' onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Training Plan'}</button><button type='button' onClick={reset}>Reset to Default</button><button type='button' onClick={autoCoach}>Auto-Assign by Coach</button></div>
            </section>
          ) : null}

          {player && tab === 'schedule' ? (
            <section className='ptv2-card'>
              <h3>Weekly Training Planner</h3>
              <div className='ptv2-actions'><button type='button' onClick={copyMon}>Copy Monday to All Days</button><button type='button' onClick={syncGames}>Sync With Team Schedule</button><button type='button' onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Player Plan'}</button></div>
              <div className='week'>{DAYS.map((d) => {
                const row = days[d] || { trainingType: 'Shooting', intensityPercent: 58 };
                const type = TYPES.find((t) => t[0] === row.trainingType) || TYPES[0];
                return <article key={d} className={gameDays[d] ? 'day gameday' : 'day'}><div><strong>{DAY_NAMES[d]}</strong><small>{gameDays[d] ? 'Game day detected' : 'No game conflict'}</small></div><select value={row.trainingType} onChange={(e) => setDays((prev) => ({ ...prev, [d]: { ...(prev[d] || {}), trainingType: e.target.value } }))}>{TYPES.map((t) => <option key={`${d}-${t[0]}`} value={t[0]}>{t[0]}</option>)}</select><input type='range' min='20' max='100' value={num(row.intensityPercent, 58)} onChange={(e) => setDays((prev) => ({ ...prev, [d]: { ...(prev[d] || {}), intensityPercent: clamp(num(e.target.value, 58), 20, 100) } }))} /><small>SHO {type[2][0]} | PASS {type[2][1]} | DEF {type[2][2]} | COND {type[2][3]} | FAT {type[2][4]} | RISK {type[2][5]}</small></article>;
              })}</div>
              <div className='sum'><div><span>Shooting</span><strong>{totals.s.toFixed(1)}</strong></div><div><span>Playmaking</span><strong>{totals.p.toFixed(1)}</strong></div><div><span>Defense</span><strong>{totals.d.toFixed(1)}</strong></div><div><span>Conditioning</span><strong>{totals.c.toFixed(1)}</strong></div><div><span>Fatigue</span><strong>{totals.f.toFixed(1)}</strong></div><div><span>Injury Risk</span><strong>{totals.r.toFixed(1)}</strong></div></div>
            </section>
          ) : null}

          {player && tab === 'reports' ? (
            <section className='ptv2-card'>
              <h3>Training Reports</h3>
              {!report ? null : <div className='report'><article><h4>Progress Highlights</h4><ul><li>7-day form average: {report.avg7}</li><li>30-day form average: {report.avg30}</li><li>Current focus: {extra}</li></ul></article><article><h4>Coach Notes</h4><p>{player.name} is in a {role} development track with {workload.toLowerCase()} workload.</p><p>Recommendation: {avgIntensity > 76 ? 'Reduce one high-intensity day and add Recovery.' : 'Maintain current plan and reassess in one week.'}</p></article></div>}
            </section>
          ) : null}
        </main>

        <aside className='ptv2-card'>
          <h3>Attributes</h3>
          <div className='attr'>
            {[['Shooting', metric.shooting], ['3PT Shooting', metric.three], ['Finishing', metric.finish], ['Passing', metric.passing], ['Perimeter Defense', metric.defense], ['Stamina', metric.stamina], ['Basketball IQ', metric.iq], ['Potential', metric.potential]].map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}
          </div>
          <h3>Coach Report</h3>
          <ul><li>Pick-and-roll reads are {focusBucket === 'PLAYMAKING' ? 'improving' : 'stable'}.</li><li>Perimeter shooting is {metric.three >= 76 ? 'reliable' : 'inconsistent'}.</li><li>Defensive focus is {focusBucket === 'DEFENSE' ? 'active this cycle' : 'available next cycle'}.</li></ul>
          <h3>Physical and Medical</h3>
          <div className='attr'><div><span>Conditioning</span><strong>{metric.stamina}</strong></div><div><span>Fatigue</span><strong>{player ? player.fatigue : '--'}</strong></div><div><span>Injury Risk</span><strong>{player && player.fatigue > 65 ? 'High' : 'Managed'}</strong></div><div><span>Load Management</span><strong>{workload}</strong></div></div>
        </aside>
      </div>

      {msg ? <p className='ptv2-msg'>{msg}</p> : null}
    </div>
  );
}

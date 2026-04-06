import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { CourtBoard, DEFAULT_TACTICS_BOARD } from '../../components/domain/CourtBoard';
import { PageHeader } from '../../components/ui';
import './tactics.css';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

const PHASE_TABS = [
  { id: 'defense', label: 'Defense' },
  { id: 'transition', label: 'Transition' },
  { id: 'attack', label: 'Attack' },
];

const OFFENSE_PRESETS = [
  { id: 'motion', label: 'Motion Offense', description: 'Ball movement and off-ball screens create open shots', rating: 85 },
  { id: 'iso', label: 'Isolation Heavy', description: 'Star players create their own shot in 1-on-1', rating: 78 },
  { id: 'pick_and_roll', label: 'Pick & Roll', description: 'Primary ball handler runs PnR actions', rating: 92 },
  { id: 'post_up', label: 'Post-Up', description: 'Feed the ball to bigs in the post', rating: 78 },
  { id: 'fast_break', label: 'Fast Break', description: 'Push tempo and score in transition', rating: 88 },
];

const DEFENSE_PRESETS = [
  { id: 'man_to_man', label: 'Man-to-Man', description: 'Each defender guards a specific player', rating: 98 },
  { id: 'zone_23', label: '2-3 Zone', description: 'Two guards up top, three players on baseline', rating: 75 },
  { id: 'zone_32', label: '3-2 Zone', description: 'Three guards up top, two players on baseline', rating: 72 },
  { id: 'full_press', label: 'Full Court Press', description: 'Apply pressure full court to force turnovers', rating: 68 },
  { id: 'switch_all', label: 'Switch Everything', description: 'All defenders switch on screens', rating: 82 },
];

const TRANSITION_PRESETS = [
  { id: 'early_offense', label: 'Early Offense', description: 'Attack before the defense is set', rating: 86 },
  { id: 'secondary_break', label: 'Secondary Break', description: 'Flow into quick-hit actions', rating: 82 },
  { id: 'control_push', label: 'Control Push', description: 'Balanced tempo with safe decisions', rating: 79 },
];

const FORMATIONS = {
  traditional: {
    label: '1-2-2 Traditional',
    board: {
      PG: { x: 0.5, y: 0.74, playerId: null },
      SG: { x: 0.3, y: 0.58, playerId: null },
      SF: { x: 0.7, y: 0.58, playerId: null },
      PF: { x: 0.36, y: 0.36, playerId: null },
      C: { x: 0.64, y: 0.36, playerId: null },
    },
  },
  spread: {
    label: '1-3-1 Spread',
    board: {
      PG: { x: 0.5, y: 0.78, playerId: null },
      SG: { x: 0.22, y: 0.58, playerId: null },
      SF: { x: 0.5, y: 0.54, playerId: null },
      PF: { x: 0.78, y: 0.58, playerId: null },
      C: { x: 0.5, y: 0.34, playerId: null },
    },
  },
  balanced: {
    label: '2-1-2 Balanced',
    board: {
      PG: { x: 0.42, y: 0.72, playerId: null },
      SG: { x: 0.58, y: 0.72, playerId: null },
      SF: { x: 0.5, y: 0.56, playerId: null },
      PF: { x: 0.38, y: 0.36, playerId: null },
      C: { x: 0.62, y: 0.36, playerId: null },
    },
  },
};

function clamp01(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function normalizePositionTags(player) {
  const raw = `${String(player?.position || '').toUpperCase()} ${String(player?.primaryPosition || '').toUpperCase()}`;
  const tags = new Set();
  POSITION_ORDER.forEach((slot) => {
    if (raw.includes(slot)) tags.add(slot);
  });
  return tags;
}

function detectFormation(board) {
  const b = board || {};
  if (Math.abs((b.SF?.x ?? 0.5) - 0.5) < 0.04) return 'spread';
  if (Math.abs((b.PG?.x ?? 0.5) - 0.5) < 0.04 && Math.abs((b.SG?.x ?? 0.3) - 0.3) < 0.06) return 'traditional';
  return 'balanced';
}

function offenseStyleToPreset(offenseStyle) {
  switch (offenseStyle) {
    case 'pick_and_roll':
      return 'pick_and_roll';
    case 'post_up':
      return 'post_up';
    case 'transition':
      return 'fast_break';
    case 'iso':
      return 'iso';
    default:
      return 'motion';
  }
}

function presetToOffenseStyle(presetId) {
  switch (presetId) {
    case 'pick_and_roll':
      return 'pick_and_roll';
    case 'post_up':
      return 'post_up';
    case 'fast_break':
      return 'transition';
    case 'iso':
      return 'iso';
    default:
      return 'balanced';
  }
}

function defenseToPreset(defenseMode, defenseScheme, defensePreset) {
  if (defensePreset) return defensePreset;
  if (defenseMode === 'zone' && defenseScheme === 'drop') return 'zone_23';
  if (defenseMode === 'zone' && defenseScheme === 'switch') return 'zone_32';
  if (defenseScheme === 'press') return 'full_press';
  if (defenseScheme === 'switch') return 'switch_all';
  return 'man_to_man';
}

function presetToDefense(presetId) {
  switch (presetId) {
    case 'zone_23':
      return { defenseMode: 'zone', defenseScheme: 'drop' };
    case 'zone_32':
      return { defenseMode: 'zone', defenseScheme: 'switch' };
    case 'full_press':
      return { defenseMode: 'hybrid', defenseScheme: 'press' };
    case 'switch_all':
      return { defenseMode: 'man', defenseScheme: 'switch' };
    default:
      return { defenseMode: 'man', defenseScheme: 'drop' };
  }
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function avg(list) {
  if (!list.length) return 0;
  return list.reduce((sum, item) => sum + item, 0) / list.length;
}

export function Tactics() {
  const {
    currentSave,
    squadPlayers,
    scheduleGames,
    teams,
    fetchSquad,
    fetchSchedule,
    fetchTeams,
    saveTactics,
  } = useGameStore();
  const [activePhase, setActivePhase] = useState('defense');
  const [saving, setSaving] = useState(false);
  const [recommendationNote, setRecommendationNote] = useState('');
  const [formation, setFormation] = useState('traditional');
  const [rotation, setRotation] = useState({ PG: null, SG: null, SF: null, PF: null, C: null });
  const [tactics, setTactics] = useState({
    offensePreset: 'motion',
    defensePreset: 'man_to_man',
    transitionStyle: 'early_offense',
    pace: 'balanced',
    threePtFocus: 50,
    defenseScheme: 'switch',
    offenseStyle: 'balanced',
    defenseMode: 'man',
    instructions: {
      fastBreak: true,
      pressAfterMade: false,
      isoStars: false,
      crashBoards: true,
    },
    board: DEFAULT_TACTICS_BOARD,
    boards: {
      attack: { ...DEFAULT_TACTICS_BOARD },
      transition: { ...DEFAULT_TACTICS_BOARD },
      defense: { ...DEFAULT_TACTICS_BOARD },
    },
  });

  useEffect(() => {
    fetchSquad();
    if (!scheduleGames?.length) fetchSchedule();
    if (!teams?.length) fetchTeams();
  }, [fetchSquad, fetchSchedule, fetchTeams, scheduleGames?.length, teams?.length]);

  useEffect(() => {
    const payload = currentSave?.data || {};
    const storedBoard = { ...DEFAULT_TACTICS_BOARD, ...(payload?.tactics?.board || {}) };
    const boards = payload?.tactics?.boards || {};
    setTactics({
      offensePreset: payload?.tactics?.offensePreset || offenseStyleToPreset(payload?.tactics?.offenseStyle || 'balanced'),
      defensePreset: defenseToPreset(payload?.tactics?.defenseMode, payload?.tactics?.defenseScheme, payload?.tactics?.defensePreset),
      transitionStyle: payload?.tactics?.transitionStyle || 'early_offense',
      pace: payload?.tactics?.pace || 'balanced',
      threePtFocus: clamp01(payload?.tactics?.threePtFocus ?? 50),
      defenseScheme: payload?.tactics?.defenseScheme || 'switch',
      offenseStyle: payload?.tactics?.offenseStyle || 'balanced',
      defenseMode: payload?.tactics?.defenseMode || 'man',
      instructions: {
        fastBreak: payload?.tactics?.instructions?.fastBreak ?? true,
        pressAfterMade: payload?.tactics?.instructions?.pressAfterMade ?? false,
        isoStars: payload?.tactics?.instructions?.isoStars ?? false,
        crashBoards: payload?.tactics?.instructions?.crashBoards ?? true,
      },
      board: storedBoard,
      boards: {
        attack: { ...DEFAULT_TACTICS_BOARD, ...(boards.attack || storedBoard) },
        transition: { ...DEFAULT_TACTICS_BOARD, ...(boards.transition || storedBoard) },
        defense: { ...DEFAULT_TACTICS_BOARD, ...(boards.defense || storedBoard) },
      },
    });
    setRotation({
      PG: payload?.rotation?.PG ?? null,
      SG: payload?.rotation?.SG ?? null,
      SF: payload?.rotation?.SF ?? null,
      PF: payload?.rotation?.PF ?? null,
      C: payload?.rotation?.C ?? null,
    });
    setFormation(detectFormation(boards.attack || storedBoard));
  }, [currentSave]);

  const playersByPosition = useMemo(() => {
    const byPos = { PG: [], SG: [], SF: [], PF: [], C: [] };
    for (const player of (squadPlayers || [])) {
      const tags = normalizePositionTags(player);
      for (const slot of POSITION_ORDER) {
        if (tags.has(slot)) byPos[slot].push(player);
      }
    }
    for (const slot of POSITION_ORDER) {
      byPos[slot].sort((a, b) => (b.overallCurrent ?? b.overall ?? 0) - (a.overallCurrent ?? a.overall ?? 0));
    }
    return byPos;
  }, [squadPlayers]);

  useEffect(() => {
    setRotation((prev) => {
      let changed = false;
      const next = { ...prev };
      POSITION_ORDER.forEach((slot) => {
        const pool = playersByPosition[slot] || [];
        if (next[slot] && !pool.some((p) => Number(p.id) === Number(next[slot]))) {
          next[slot] = null;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [playersByPosition]);

  const applyFormation = (formationKey) => {
    const base = FORMATIONS[formationKey]?.board || FORMATIONS.traditional.board;
    setFormation(formationKey);
    setTactics((prev) => ({
      ...prev,
      boards: {
        ...(prev.boards || {}),
        [activePhase]: {
          ...(prev.boards?.[activePhase] || {}),
          PG: { ...base.PG, playerId: prev.boards?.[activePhase]?.PG?.playerId ?? rotation.PG ?? null },
          SG: { ...base.SG, playerId: prev.boards?.[activePhase]?.SG?.playerId ?? rotation.SG ?? null },
          SF: { ...base.SF, playerId: prev.boards?.[activePhase]?.SF?.playerId ?? rotation.SF ?? null },
          PF: { ...base.PF, playerId: prev.boards?.[activePhase]?.PF?.playerId ?? rotation.PF ?? null },
          C: { ...base.C, playerId: prev.boards?.[activePhase]?.C?.playerId ?? rotation.C ?? null },
        },
      },
      board: activePhase === 'attack'
        ? {
            PG: { ...base.PG, playerId: prev.board?.PG?.playerId ?? rotation.PG ?? null },
            SG: { ...base.SG, playerId: prev.board?.SG?.playerId ?? rotation.SG ?? null },
            SF: { ...base.SF, playerId: prev.board?.SF?.playerId ?? rotation.SF ?? null },
            PF: { ...base.PF, playerId: prev.board?.PF?.playerId ?? rotation.PF ?? null },
            C: { ...base.C, playerId: prev.board?.C?.playerId ?? rotation.C ?? null },
          }
        : prev.board,
    }));
  };

  const managedTeamId = currentSave?.managedTeamId || currentSave?.teamId || null;
  const currentDate = String(currentSave?.data?.currentDate || '').slice(0, 10);
  const upcomingGame = useMemo(() => {
    if (!managedTeamId) return null;
    return (scheduleGames || [])
      .filter((game) => {
        const day = String(game.gameDate || '').slice(0, 10);
        const managed = Number(game.homeTeamId) === Number(managedTeamId) || Number(game.awayTeamId) === Number(managedTeamId);
        const upcoming = day >= currentDate;
        return managed && upcoming;
      })
      .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate))[0] || null;
  }, [scheduleGames, managedTeamId, currentDate]);

  const opponentTeam = useMemo(() => {
    if (!upcomingGame || !managedTeamId) return null;
    const opponentId = Number(upcomingGame.homeTeamId) === Number(managedTeamId) ? upcomingGame.awayTeamId : upcomingGame.homeTeamId;
    return teams.find((team) => Number(team.id) === Number(opponentId)) || null;
  }, [upcomingGame, teams, managedTeamId]);

  const buildRecommendedPlan = () => {
    const pg = playersByPosition.PG || [];
    const sg = playersByPosition.SG || [];
    const sf = playersByPosition.SF || [];
    const pf = playersByPosition.PF || [];
    const c = playersByPosition.C || [];
    const rotationRec = {
      PG: pg[0]?.id ?? null,
      SG: sg[0]?.id ?? null,
      SF: sf[0]?.id ?? null,
      PF: pf[0]?.id ?? null,
      C: c[0]?.id ?? null,
    };
    const starters = [rotationRec.PG, rotationRec.SG, rotationRec.SF, rotationRec.PF, rotationRec.C]
      .map((id) => (squadPlayers || []).find((player) => Number(player.id) === Number(id)))
      .filter(Boolean);

    const starterFatigueAvg = avg(starters.map((player) => safeNum(player.fatigue, safeNum(currentSave?.data?.playerState?.[String(player.id)]?.fatigue, 12))));
    const starterAgeAvg = avg(starters.map((player) => safeNum(player.age, 26)));
    const guardStrength = avg([...pg, ...sg].slice(0, 4).map((player) => safeNum(player.overallCurrent ?? player.overall, 72)));
    const wingStrength = avg([...sf].slice(0, 2).map((player) => safeNum(player.overallCurrent ?? player.overall, 72)));
    const bigStrength = avg([...pf, ...c].slice(0, 4).map((player) => safeNum(player.overallCurrent ?? player.overall, 72)));
    const opponentOff = safeNum(opponentTeam?.offensiveRating ?? opponentTeam?.overallRating, 75);
    const opponentDef = safeNum(opponentTeam?.defensiveRating ?? opponentTeam?.overallRating, 75);

    let recommendedFormation = 'balanced';
    if (guardStrength >= bigStrength + 2) recommendedFormation = 'spread';
    if (bigStrength >= guardStrength + 2) recommendedFormation = 'traditional';

    let offensePreset = 'motion';
    if (guardStrength >= 80) offensePreset = 'pick_and_roll';
    if (bigStrength >= 82 && bigStrength > guardStrength + 1) offensePreset = 'post_up';
    if (starterFatigueAvg <= 35 && starterAgeAvg <= 27 && opponentDef < 78) offensePreset = 'fast_break';

    let transitionStyle = 'secondary_break';
    if (offensePreset === 'fast_break') transitionStyle = 'early_offense';
    if (starterFatigueAvg >= 58) transitionStyle = 'control_push';

    let defensePreset = 'man_to_man';
    if (opponentOff >= 83 && guardStrength < opponentOff - 2) defensePreset = 'zone_23';
    if (opponentOff >= 86 && bigStrength >= guardStrength + 1) defensePreset = 'switch_all';

    const defenseMapped = presetToDefense(defensePreset);
    const pace = transitionStyle === 'control_push'
      ? 'slow'
      : offensePreset === 'fast_break'
        ? 'fast'
        : 'balanced';
    const offenseStyle = presetToOffenseStyle(offensePreset);

    return {
      formation: recommendedFormation,
      rotation: rotationRec,
      tacticsPatch: {
        offensePreset,
        transitionStyle,
        defensePreset,
        pace,
        offenseStyle,
        defenseMode: defenseMapped.defenseMode,
        defenseScheme: defenseMapped.defenseScheme,
        instructions: {
          fastBreak: offensePreset === 'fast_break' || transitionStyle === 'early_offense',
          pressAfterMade: defensePreset === 'full_press',
          isoStars: offensePreset === 'iso',
          crashBoards: bigStrength >= 80,
        },
      },
    };
  };

  const applyRecommendation = () => {
    const rec = buildRecommendedPlan();
    const base = FORMATIONS[rec.formation]?.board || FORMATIONS.traditional.board;
    setFormation(rec.formation);
    setRotation(rec.rotation);
    setTactics((prev) => ({
      ...prev,
      ...rec.tacticsPatch,
      board: {
        PG: { ...base.PG, playerId: rec.rotation.PG },
        SG: { ...base.SG, playerId: rec.rotation.SG },
        SF: { ...base.SF, playerId: rec.rotation.SF },
        PF: { ...base.PF, playerId: rec.rotation.PF },
        C: { ...base.C, playerId: rec.rotation.C },
      },
      boards: {
        ...(prev.boards || {}),
        attack: {
          PG: { ...base.PG, playerId: rec.rotation.PG },
          SG: { ...base.SG, playerId: rec.rotation.SG },
          SF: { ...base.SF, playerId: rec.rotation.SF },
          PF: { ...base.PF, playerId: rec.rotation.PF },
          C: { ...base.C, playerId: rec.rotation.C },
        },
        transition: {
          PG: { ...base.PG, playerId: rec.rotation.PG },
          SG: { ...base.SG, playerId: rec.rotation.SG },
          SF: { ...base.SF, playerId: rec.rotation.SF },
          PF: { ...base.PF, playerId: rec.rotation.PF },
          C: { ...base.C, playerId: rec.rotation.C },
        },
        defense: {
          PG: { ...base.PG, playerId: rec.rotation.PG },
          SG: { ...base.SG, playerId: rec.rotation.SG },
          SF: { ...base.SF, playerId: rec.rotation.SF },
          PF: { ...base.PF, playerId: rec.rotation.PF },
          C: { ...base.C, playerId: rec.rotation.C },
        },
      },
    }));
    setRecommendationNote(
      opponentTeam
        ? `Recommended for ${opponentTeam.shortName}: ${rec.tacticsPatch.offensePreset.replaceAll('_', ' ')} + ${rec.tacticsPatch.defensePreset.replaceAll('_', ' ')} (${rec.formation}).`
        : `Recommendation applied: ${rec.tacticsPatch.offensePreset.replaceAll('_', ' ')} + ${rec.tacticsPatch.defensePreset.replaceAll('_', ' ')} (${rec.formation}).`,
    );
  };

  const applyAndSaveRecommendation = async () => {
    applyRecommendation();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await saveAll();
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await saveTactics({
        ...tactics,
        boards: {
          ...(tactics.boards || {}),
          attack: tactics.boards?.attack || tactics.board,
          transition: tactics.boards?.transition || tactics.board,
          defense: tactics.boards?.defense || tactics.board,
        },
        board: {
          ...(tactics.boards?.attack || tactics.board || {}),
          PG: { ...(tactics.boards?.attack?.PG || tactics.board?.PG || DEFAULT_TACTICS_BOARD.PG), playerId: rotation.PG ?? null },
          SG: { ...(tactics.boards?.attack?.SG || tactics.board?.SG || DEFAULT_TACTICS_BOARD.SG), playerId: rotation.SG ?? null },
          SF: { ...(tactics.boards?.attack?.SF || tactics.board?.SF || DEFAULT_TACTICS_BOARD.SF), playerId: rotation.SF ?? null },
          PF: { ...(tactics.boards?.attack?.PF || tactics.board?.PF || DEFAULT_TACTICS_BOARD.PF), playerId: rotation.PF ?? null },
          C: { ...(tactics.boards?.attack?.C || tactics.board?.C || DEFAULT_TACTICS_BOARD.C), playerId: rotation.C ?? null },
        },
      }, rotation);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tactics-page">
      <PageHeader title="Tactics Center" subtitle="Set phase-specific boards and tactical styles for attack, transition, and defense." />

      <div className="tac-tabs">
        {PHASE_TABS.map((tab) => (
          <button key={tab.id} type="button" className={`tac-tab ${activePhase === tab.id ? 'is-active' : ''}`} onClick={() => setActivePhase(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div className="tac-grid">
        <section className="tac-card tac-main">
          <div className="tac-board-header">
            <h3>{activePhase.charAt(0).toUpperCase() + activePhase.slice(1)} Board</h3>
            <select className="tac-select" value={formation} onChange={(e) => applyFormation(e.target.value)}>
              <option value="traditional">1-2-2 Traditional</option>
              <option value="spread">1-3-1 Spread</option>
              <option value="balanced">2-1-2 Balanced</option>
            </select>
          </div>

          <CourtBoard
            players={squadPlayers}
            playersByPosition={playersByPosition}
            view={activePhase}
            board={tactics.boards?.[activePhase] || tactics.board}
            onBoardChange={(nextBoard) => setTactics((prev) => ({
              ...prev,
              board: activePhase === 'attack' ? nextBoard : prev.board,
              boards: {
                ...(prev.boards || {}),
                [activePhase]: nextBoard,
              },
            }))}
          />
        </section>

        <aside className="tac-card tac-side">
          <div className="tac-panel tac-reco-panel">
            <h3>Recommended Setup</h3>
            <p>
              {opponentTeam
                ? `Built from your starting 5 profile and next opponent (${opponentTeam.name}).`
                : 'Built from your current starting 5 and squad profile.'}
            </p>
            <div className="tac-reco-actions">
              <button type="button" className="tac-reco-btn" onClick={applyRecommendation}>Apply Recommendation</button>
              <button type="button" className="tac-reco-btn is-save" onClick={applyAndSaveRecommendation} disabled={saving}>
                {saving ? 'Saving...' : 'Apply + Save'}
              </button>
            </div>
            {recommendationNote ? <small>{recommendationNote}</small> : null}
          </div>

          {activePhase !== 'defense' ? (
            <div className="tac-panel">
              <h3>Offense</h3>
              <div className="tac-options-list offense">
                {OFFENSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`tac-option ${tactics.offensePreset === preset.id ? 'is-selected' : ''}`}
                    onClick={() => setTactics((prev) => ({
                      ...prev,
                      offensePreset: preset.id,
                      offenseStyle: presetToOffenseStyle(preset.id),
                      pace: preset.id === 'fast_break' ? 'fast' : prev.pace,
                      instructions: {
                        ...prev.instructions,
                        fastBreak: preset.id === 'fast_break' ? true : prev.instructions.fastBreak,
                        isoStars: preset.id === 'iso' ? true : prev.instructions.isoStars,
                      },
                    }))}
                  >
                    <div className="tac-option-copy">
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </div>
                    <div className="tac-option-score">
                      <div className="tac-option-bar"><span style={{ width: `${preset.rating}%` }} /></div>
                      <em>{preset.rating}</em>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePhase === 'transition' ? (
            <div className="tac-panel">
              <h3>Transition Style</h3>
              <div className="tac-options-list transition">
                {TRANSITION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`tac-option ${tactics.transitionStyle === preset.id ? 'is-selected' : ''}`}
                    onClick={() => setTactics((prev) => ({
                      ...prev,
                      transitionStyle: preset.id,
                      pace: preset.id === 'control_push' ? 'balanced' : 'fast',
                      instructions: {
                        ...prev.instructions,
                        fastBreak: preset.id !== 'control_push',
                      },
                    }))}
                  >
                    <div className="tac-option-copy">
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </div>
                    <div className="tac-option-score">
                      <div className="tac-option-bar"><span style={{ width: `${preset.rating}%` }} /></div>
                      <em>{preset.rating}</em>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePhase !== 'attack' ? (
            <div className="tac-panel">
              <h3>Defense</h3>
              <div className="tac-options-list defense">
                {DEFENSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`tac-option ${tactics.defensePreset === preset.id ? 'is-selected' : ''}`}
                    onClick={() => {
                      const mapped = presetToDefense(preset.id);
                      setTactics((prev) => ({
                        ...prev,
                        defensePreset: preset.id,
                        defenseMode: mapped.defenseMode,
                        defenseScheme: mapped.defenseScheme,
                        instructions: {
                          ...prev.instructions,
                          pressAfterMade: preset.id === 'full_press' ? true : prev.instructions.pressAfterMade,
                        },
                      }));
                    }}
                  >
                    <div className="tac-option-copy">
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </div>
                    <div className="tac-option-score">
                      <div className="tac-option-bar"><span style={{ width: `${preset.rating}%` }} /></div>
                      <em>{preset.rating}</em>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="tac-panel">
            <h3>Starting Five</h3>
            <div className="tac-lineup">
              {POSITION_ORDER.map((slot) => (
                <label key={slot} className="tac-lineup-row">
                  <span>{slot}</span>
                  <select
                    className="tac-select"
                    value={rotation[slot] ?? ''}
                    onChange={(e) => setRotation((prev) => ({ ...prev, [slot]: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">Unassigned</option>
                    {(playersByPosition[slot] || []).map((player) => (
                      <option key={`${slot}-${player.id}`} value={player.id}>{player.name} ({player.overallCurrent ?? player.overall ?? 0})</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <button className="tac-save-btn" type="button" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving...' : 'Save Tactics'}
          </button>
        </aside>
      </div>
    </div>
  );
}

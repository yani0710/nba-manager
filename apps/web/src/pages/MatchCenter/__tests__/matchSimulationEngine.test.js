import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSimulationSecond,
  createMatchState,
  getConsistencySnapshot,
  playOnePossession,
  playUntilQuarterEnd,
  quickSimToEndLocal,
} from '../matchSimulationEngine.js';

const homeLineup = {
  PG: { id: 1, name: 'Home PG', position: 'PG', overall: 88 },
  SG: { id: 2, name: 'Home SG', position: 'SG', overall: 84 },
  SF: { id: 3, name: 'Home SF', position: 'SF', overall: 82 },
  PF: { id: 4, name: 'Home PF', position: 'PF', overall: 80 },
  C: { id: 5, name: 'Home C', position: 'C', overall: 83 },
};

const awayLineup = {
  PG: { id: 11, name: 'Away PG', position: 'PG', overall: 87 },
  SG: { id: 12, name: 'Away SG', position: 'SG', overall: 84 },
  SF: { id: 13, name: 'Away SF', position: 'SF', overall: 81 },
  PF: { id: 14, name: 'Away PF', position: 'PF', overall: 80 },
  C: { id: 15, name: 'Away C', position: 'C', overall: 82 },
};

const ctx = {
  homeTeam: { shortName: 'HME', overallRating: 84, offensiveRating: 84, defensiveRating: 83 },
  awayTeam: { shortName: 'AWY', overallRating: 83, offensiveRating: 83, defensiveRating: 82 },
  homeLineup,
  awayLineup,
  tactics: { slowPace: false, transitionPush: true, fullCourtPress: false, isoPlays: false, feedPost: false },
};

test('single possession updates scoreboard, quarter scores and play-by-play consistently', () => {
  const state = createMatchState({ seed: 1234, homeLineup, awayLineup, debug: true });
  playOnePossession(state, ctx);
  const snap = getConsistencySnapshot(state);
  assert.equal(snap.homeScore, snap.qHome);
  assert.equal(snap.awayScore, snap.qAway);
  assert.equal(snap.homeScore, snap.pbpHome);
  assert.equal(snap.awayScore, snap.pbpAway);
  assert.ok(state.playByPlay.length >= 1);
});

test('multiple possessions in same quarter stay consistent', () => {
  const state = createMatchState({ seed: 2222, homeLineup, awayLineup, debug: true });
  for (let i = 0; i < 12; i += 1) {
    playOnePossession(state, ctx);
  }
  assert.equal(state.quarter, 1);
  const snap = getConsistencySnapshot(state);
  assert.equal(snap.issues.length, 0);
});

test('quarter transition from Q1 to Q2 keeps totals consistent', () => {
  const state = createMatchState({ seed: 3333, homeLineup, awayLineup, debug: true });
  playUntilQuarterEnd(state, ctx, 2000);
  assert.equal(state.quarter >= 2 || state.isFinal, true);
  const snap = getConsistencySnapshot(state);
  assert.equal(snap.issues.length, 0);
});

test('second-by-second ticking reaches scoring events and remains consistent', () => {
  const state = createMatchState({ seed: 4444, homeLineup, awayLineup, debug: true });
  for (let i = 0; i < 200; i += 1) {
    advanceSimulationSecond(state, ctx);
    if (state.isFinal) break;
  }
  const snap = getConsistencySnapshot(state);
  assert.equal(snap.issues.length, 0);
  assert.ok(state.playByPlay.length > 0);
});

test('quick sim to end finishes and preserves score/quarter/pbp parity', () => {
  const state = createMatchState({ seed: 5555, homeLineup, awayLineup, debug: true });
  quickSimToEndLocal(state, ctx, 12000);
  assert.equal(state.isFinal, true);
  const snap = getConsistencySnapshot(state);
  assert.equal(snap.issues.length, 0);
});

test('deterministic seeded mode reproduces same final score and event count', () => {
  const a = createMatchState({ seed: 7777, homeLineup, awayLineup, debug: true });
  const b = createMatchState({ seed: 7777, homeLineup, awayLineup, debug: true });
  quickSimToEndLocal(a, ctx, 12000);
  quickSimToEndLocal(b, ctx, 12000);
  assert.equal(a.homeScore, b.homeScore);
  assert.equal(a.awayScore, b.awayScore);
  assert.equal(a.playByPlay.length, b.playByPlay.length);
});


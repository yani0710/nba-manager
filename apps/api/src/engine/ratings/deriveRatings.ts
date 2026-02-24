type PosGroup = "guard" | "wing" | "big";

export type AdvancedVector = {
  pos: string;
  per: number | null;
  tsPercent: number | null;
  x3pAr: number | null;
  orbPercent: number | null;
  drbPercent: number | null;
  trbPercent: number | null;
  astPercent: number | null;
  stlPercent: number | null;
  blkPercent: number | null;
  tovPercent: number | null;
  usgPercent: number | null;
  ws48: number | null;
  obpm: number | null;
  dbpm: number | null;
  bpm: number | null;
  vorp: number | null;
};

export type RatingAttributes = {
  shooting3: number;
  shootingMid: number;
  finishing: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  athleticism: number;
  iq: number;
};

export type RatingOutcome = {
  attributes: RatingAttributes;
  overall: number;
  potential: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toSafe(value: number | null | undefined, fallback = 0): number {
  return Number.isFinite(value as number) ? (value as number) : fallback;
}

function percentileOf(value: number, population: number[]): number {
  if (population.length === 0) return 0.5;
  let count = 0;
  for (const x of population) {
    if (x <= value) count += 1;
  }
  return clamp(count / population.length, 0, 1);
}

function scaleByPercentile(value: number, population: number[], min = 40, max = 95): number {
  const p = percentileOf(value, population);
  return Math.round(min + p * (max - min));
}

function parsePosGroup(pos: string): PosGroup {
  const token = (pos ?? "").toUpperCase();
  if (token.includes("PG") || token.includes("SG") || token === "G" || token.includes("G-")) return "guard";
  if (token.includes("C") || token.includes("PF") || token.includes("F-C") || token.includes("C-F")) return "big";
  return "wing";
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

type SkillRaw = RatingAttributes;

export function deriveRawSkills(v: AdvancedVector): SkillRaw {
  const ts = toSafe(v.tsPercent);
  const x3 = toSafe(v.x3pAr);
  const obpm = toSafe(v.obpm);
  const bpm = toSafe(v.bpm);
  const ast = toSafe(v.astPercent);
  const tov = toSafe(v.tovPercent);
  const trb = toSafe(v.trbPercent);
  const orb = toSafe(v.orbPercent);
  const drb = toSafe(v.drbPercent);
  const stl = toSafe(v.stlPercent);
  const blk = toSafe(v.blkPercent);
  const dbpm = toSafe(v.dbpm);
  const per = toSafe(v.per);
  const usg = toSafe(v.usgPercent);
  const ws48 = toSafe(v.ws48);
  const vorp = toSafe(v.vorp);

  return {
    shooting3: x3 * 100 + ts * 60 + obpm * 5,
    shootingMid: (1 - x3) * 40 + ts * 60 + obpm * 4,
    finishing: (1 - x3) * 100 + ts * 70 + usg * 1.2,
    playmaking: ast * 1.8 - tov * 1.3 + bpm * 7,
    rebounding: trb * 1.2 + orb * 0.9 + drb * 0.8,
    defense: stl * 2 + blk * 2 + dbpm * 8,
    athleticism: per * 2 + usg * 1.2 + bpm * 6,
    iq: ws48 * 300 + vorp * 12 + bpm * 8,
  };
}

function weightedOverall(group: PosGroup, a: RatingAttributes): number {
  if (group === "guard") {
    return (
      a.playmaking * 0.24 +
      a.shooting3 * 0.22 +
      a.iq * 0.2 +
      a.defense * 0.14 +
      a.athleticism * 0.12 +
      a.finishing * 0.08
    );
  }
  if (group === "big") {
    return (
      a.rebounding * 0.24 +
      a.defense * 0.22 +
      a.finishing * 0.2 +
      a.iq * 0.14 +
      a.athleticism * 0.12 +
      a.playmaking * 0.05 +
      a.shooting3 * 0.03
    );
  }
  return (
    a.shooting3 * 0.15 +
    a.shootingMid * 0.1 +
    a.finishing * 0.14 +
    a.playmaking * 0.14 +
    a.rebounding * 0.14 +
    a.defense * 0.14 +
    a.athleticism * 0.1 +
    a.iq * 0.09
  );
}

export function deriveRatingsForLeague(
  players: Array<{
    id: number;
    externalRef: string | null;
    age: number;
    advanced: AdvancedVector;
  }>,
): Map<number, RatingOutcome> {
  const rawByPlayer = players.map((p) => ({
    id: p.id,
    age: p.age,
    externalRef: p.externalRef ?? `player-${p.id}`,
    group: parsePosGroup(p.advanced.pos),
    raw: deriveRawSkills(p.advanced),
  }));

  const populations: Record<keyof SkillRaw, number[]> = {
    shooting3: rawByPlayer.map((p) => p.raw.shooting3),
    shootingMid: rawByPlayer.map((p) => p.raw.shootingMid),
    finishing: rawByPlayer.map((p) => p.raw.finishing),
    playmaking: rawByPlayer.map((p) => p.raw.playmaking),
    rebounding: rawByPlayer.map((p) => p.raw.rebounding),
    defense: rawByPlayer.map((p) => p.raw.defense),
    athleticism: rawByPlayer.map((p) => p.raw.athleticism),
    iq: rawByPlayer.map((p) => p.raw.iq),
  };

  const out = new Map<number, RatingOutcome>();
  for (const p of rawByPlayer) {
    const attrs: RatingAttributes = {
      shooting3: scaleByPercentile(p.raw.shooting3, populations.shooting3),
      shootingMid: scaleByPercentile(p.raw.shootingMid, populations.shootingMid),
      finishing: scaleByPercentile(p.raw.finishing, populations.finishing),
      playmaking: scaleByPercentile(p.raw.playmaking, populations.playmaking),
      rebounding: scaleByPercentile(p.raw.rebounding, populations.rebounding),
      defense: scaleByPercentile(p.raw.defense, populations.defense),
      athleticism: scaleByPercentile(p.raw.athleticism, populations.athleticism),
      iq: scaleByPercentile(p.raw.iq, populations.iq),
    };

    const variance = (hashString(p.externalRef) % 3) - 1;
    const overall = clamp(Math.round(weightedOverall(p.group, attrs) + variance), 50, 98);

    const age = p.age;
    const ageBonus =
      age <= 21 ? 12 :
      age <= 24 ? 8 :
      age <= 27 ? 4 :
      age <= 30 ? 1 :
      age <= 32 ? 0 : -2;
    const potential = clamp(Math.max(overall, overall + ageBonus), 55, 99);

    out.set(p.id, { attributes: attrs, overall, potential });
  }
  return out;
}

export function derivePlayerFormFromGameScores(gameScores: number[]): number {
  if (gameScores.length === 0) return 0;
  const seasonAvg = gameScores.reduce((s, v) => s + v, 0) / gameScores.length;
  const last5 = gameScores.slice(0, 5);
  const last5Avg = last5.reduce((s, v) => s + v, 0) / last5.length;
  const variance = gameScores.reduce((s, v) => s + (v - seasonAvg) ** 2, 0) / Math.max(1, gameScores.length);
  const std = Math.sqrt(variance) || 1;
  const z = (last5Avg - seasonAvg) / std;
  return clamp(Math.round(z * 4), -10, 10);
}

export function deriveFallbackForm(bpm: number | null, ws48: number | null): number {
  const signal = toSafe(bpm) + toSafe(ws48) * 20;
  return clamp(Math.round(signal / 4), -5, 5);
}

export function deriveTeamForm(lastFiveResults: Array<"W" | "L">): number {
  if (lastFiveResults.length === 0) return 0;
  const wins = lastFiveResults.filter((r) => r === "W").length;
  const losses = lastFiveResults.length - wins;
  return clamp((wins - losses) * 2, -10, 10);
}

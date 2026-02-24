"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveRawSkills = deriveRawSkills;
exports.deriveRatingsForLeague = deriveRatingsForLeague;
exports.derivePlayerFormFromGameScores = derivePlayerFormFromGameScores;
exports.deriveFallbackForm = deriveFallbackForm;
exports.deriveTeamForm = deriveTeamForm;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function toSafe(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}
function percentileOf(value, population) {
    if (population.length === 0)
        return 0.5;
    let count = 0;
    for (const x of population) {
        if (x <= value)
            count += 1;
    }
    return clamp(count / population.length, 0, 1);
}
function scaleByPercentile(value, population, min = 40, max = 95) {
    const p = percentileOf(value, population);
    return Math.round(min + p * (max - min));
}
function parsePosGroup(pos) {
    const token = (pos ?? "").toUpperCase();
    if (token.includes("PG") || token.includes("SG") || token === "G" || token.includes("G-"))
        return "guard";
    if (token.includes("C") || token.includes("PF") || token.includes("F-C") || token.includes("C-F"))
        return "big";
    return "wing";
}
function hashString(input) {
    let h = 0;
    for (let i = 0; i < input.length; i += 1) {
        h = (h * 31 + input.charCodeAt(i)) >>> 0;
    }
    return h;
}
function deriveRawSkills(v) {
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
function weightedOverall(group, a) {
    if (group === "guard") {
        return (a.playmaking * 0.24 +
            a.shooting3 * 0.22 +
            a.iq * 0.2 +
            a.defense * 0.14 +
            a.athleticism * 0.12 +
            a.finishing * 0.08);
    }
    if (group === "big") {
        return (a.rebounding * 0.24 +
            a.defense * 0.22 +
            a.finishing * 0.2 +
            a.iq * 0.14 +
            a.athleticism * 0.12 +
            a.playmaking * 0.05 +
            a.shooting3 * 0.03);
    }
    return (a.shooting3 * 0.15 +
        a.shootingMid * 0.1 +
        a.finishing * 0.14 +
        a.playmaking * 0.14 +
        a.rebounding * 0.14 +
        a.defense * 0.14 +
        a.athleticism * 0.1 +
        a.iq * 0.09);
}
function deriveRatingsForLeague(players) {
    const rawByPlayer = players.map((p) => ({
        id: p.id,
        age: p.age,
        externalRef: p.externalRef ?? `player-${p.id}`,
        group: parsePosGroup(p.advanced.pos),
        raw: deriveRawSkills(p.advanced),
    }));
    const populations = {
        shooting3: rawByPlayer.map((p) => p.raw.shooting3),
        shootingMid: rawByPlayer.map((p) => p.raw.shootingMid),
        finishing: rawByPlayer.map((p) => p.raw.finishing),
        playmaking: rawByPlayer.map((p) => p.raw.playmaking),
        rebounding: rawByPlayer.map((p) => p.raw.rebounding),
        defense: rawByPlayer.map((p) => p.raw.defense),
        athleticism: rawByPlayer.map((p) => p.raw.athleticism),
        iq: rawByPlayer.map((p) => p.raw.iq),
    };
    const out = new Map();
    for (const p of rawByPlayer) {
        const attrs = {
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
        const ageBonus = age <= 21 ? 12 :
            age <= 24 ? 8 :
                age <= 27 ? 4 :
                    age <= 30 ? 1 :
                        age <= 32 ? 0 : -2;
        const potential = clamp(Math.max(overall, overall + ageBonus), 55, 99);
        out.set(p.id, { attributes: attrs, overall, potential });
    }
    return out;
}
function derivePlayerFormFromGameScores(gameScores) {
    if (gameScores.length === 0)
        return 0;
    const seasonAvg = gameScores.reduce((s, v) => s + v, 0) / gameScores.length;
    const last5 = gameScores.slice(0, 5);
    const last5Avg = last5.reduce((s, v) => s + v, 0) / last5.length;
    const variance = gameScores.reduce((s, v) => s + (v - seasonAvg) ** 2, 0) / Math.max(1, gameScores.length);
    const std = Math.sqrt(variance) || 1;
    const z = (last5Avg - seasonAvg) / std;
    return clamp(Math.round(z * 4), -10, 10);
}
function deriveFallbackForm(bpm, ws48) {
    const signal = toSafe(bpm) + toSafe(ws48) * 20;
    return clamp(Math.round(signal / 4), -5, 5);
}
function deriveTeamForm(lastFiveResults) {
    if (lastFiveResults.length === 0)
        return 0;
    const wins = lastFiveResults.filter((r) => r === "W").length;
    const losses = lastFiveResults.length - wins;
    return clamp((wins - losses) * 2, -10, 10);
}
//# sourceMappingURL=deriveRatings.js.map
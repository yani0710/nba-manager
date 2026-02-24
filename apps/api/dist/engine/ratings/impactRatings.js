"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeImpactRatings = computeImpactRatings;
exports.computeTeamForm = computeTeamForm;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function asUnitPercent(value) {
    return value > 1 ? value / 100 : value;
}
function toPosGroup(position) {
    const pos = String(position ?? "").toUpperCase();
    if (pos.includes("PG"))
        return "PG";
    if (pos.includes("SG"))
        return "SG";
    if (pos.includes("SF"))
        return "SF";
    if (pos.includes("PF"))
        return "PF";
    if (pos.includes("C"))
        return "C";
    if (pos === "G")
        return "PG";
    if (pos === "F")
        return "SF";
    return "SF";
}
function percentileRank(values, x) {
    if (values.length === 0)
        return 50;
    const sorted = [...values].sort((a, b) => a - b);
    let less = 0;
    let equal = 0;
    for (const v of sorted) {
        if (v < x)
            less += 1;
        else if (v === x)
            equal += 1;
    }
    const p = ((less + 0.5 * equal) / sorted.length) * 100;
    return clamp(p, 0, 100);
}
function weightedOverall(pos, att, play, def, phy) {
    if (pos === "PG")
        return att * 0.35 + play * 0.3 + def * 0.2 + phy * 0.15;
    if (pos === "SG")
        return att * 0.4 + play * 0.2 + def * 0.2 + phy * 0.2;
    if (pos === "SF")
        return att * 0.3 + play * 0.15 + def * 0.25 + phy * 0.3;
    if (pos === "PF")
        return att * 0.25 + play * 0.1 + def * 0.3 + phy * 0.35;
    return att * 0.2 + play * 0.1 + def * 0.35 + phy * 0.35;
}
function metricRaw(input) {
    const ts = asUnitPercent(input.ts) * 100;
    const rts = asUnitPercent(input.rts) * 100;
    const twoP = asUnitPercent(input.twoPpct) * 100;
    const threeP = asUnitPercent(input.threePpct) * 100;
    const ft = asUnitPercent(input.ftPct) * 100;
    const cTov = asUnitPercent(input.ctovPct) * 100;
    const heightBonus = input.heightCm ? (input.heightCm - 195) * 0.08 : 0;
    const weightBonus = input.weightKg ? (input.weightKg - 95) * 0.05 : 0;
    const att = input.pts * 0.24 + ts * 0.12 + rts * 0.08 + twoP * 0.08 + threeP * 0.12 + input.threePA * 0.1 + ft * 0.06 + input.fta * 0.06 + input.ptsCreated * 0.14;
    const play = input.ast * 0.28 + input.onBallPct * 0.2 + input.rimAst * 0.18 + input.ptsCreated * 0.18 - input.tov * 0.12 - cTov * 0.08;
    const def = input.dpm * 0.3 + input.ddpm * 0.35 + input.stl * 0.15 + input.blk * 0.15 + input.odpm * 0.05;
    const phy = input.mpg * 0.22 + input.minTotal * 0.04 + input.reb * 0.28 + input.oreb * 0.18 + input.dreb * 0.18 + heightBonus + weightBonus;
    const iq = rts * 0.35 - input.tov * 0.15 - cTov * 0.1 + input.onBallPct * 0.15 + input.mpg * 0.1 + input.dpm * 0.15;
    return { att, play, def, phy, iq, ts, rts, twoP, threeP, ft, cTov };
}
function computeImpactRatings(inputs) {
    const byGroup = new Map();
    for (const row of inputs) {
        const group = toPosGroup(row.position);
        const list = byGroup.get(group) ?? [];
        list.push(row);
        byGroup.set(group, list);
    }
    const output = [];
    for (const [group, rows] of byGroup.entries()) {
        const raw = rows.map((row) => ({ row, ...metricRaw(row) }));
        const attVals = raw.map((r) => r.att);
        const playVals = raw.map((r) => r.play);
        const defVals = raw.map((r) => r.def);
        const phyVals = raw.map((r) => r.phy);
        const iqVals = raw.map((r) => r.iq);
        for (const r of raw) {
            const att = percentileRank(attVals, r.att);
            const play = percentileRank(playVals, r.play);
            const def = percentileRank(defVals, r.def);
            const phy = percentileRank(phyVals, r.phy);
            const iq = percentileRank(iqVals, r.iq);
            const overall = Math.round(clamp(weightedOverall(group, att, play, def, phy), 50, 99));
            output.push({
                playerId: r.row.playerId,
                positionGroup: group,
                att: Math.round(att),
                play: Math.round(play),
                def: Math.round(def),
                phy: Math.round(phy),
                iq: Math.round(iq),
                overall,
                attributes: {
                    att: Math.round(att),
                    play: Math.round(play),
                    def: Math.round(def),
                    phy: Math.round(phy),
                    iq: Math.round(iq),
                    shooting: {
                        twoP: Math.round(percentileRank(raw.map((x) => x.twoP), r.twoP)),
                        threeP: Math.round(percentileRank(raw.map((x) => x.threeP), r.threeP)),
                        ft: Math.round(percentileRank(raw.map((x) => x.ft), r.ft)),
                        volume3PA: Math.round(percentileRank(raw.map((x) => x.row.threePA), r.row.threePA)),
                    },
                    defense: {
                        dpm: Math.round(percentileRank(raw.map((x) => x.row.dpm), r.row.dpm)),
                        ddpm: Math.round(percentileRank(raw.map((x) => x.row.ddpm), r.row.ddpm)),
                        stocks: Math.round(percentileRank(raw.map((x) => x.row.stl + x.row.blk), r.row.stl + r.row.blk)),
                    },
                    creation: {
                        ast: Math.round(percentileRank(raw.map((x) => x.row.ast), r.row.ast)),
                        onBall: Math.round(percentileRank(raw.map((x) => x.row.onBallPct), r.row.onBallPct)),
                        ptsCreated: Math.round(percentileRank(raw.map((x) => x.row.ptsCreated), r.row.ptsCreated)),
                    },
                    rebounding: {
                        oreb: Math.round(percentileRank(raw.map((x) => x.row.oreb), r.row.oreb)),
                        dreb: Math.round(percentileRank(raw.map((x) => x.row.dreb), r.row.dreb)),
                    },
                    efficiency: {
                        ts: Math.round(percentileRank(raw.map((x) => x.row.ts), r.row.ts)),
                        rts: Math.round(percentileRank(raw.map((x) => x.row.rts), r.row.rts)),
                    },
                    ballSecurity: {
                        tov: Math.round(100 - percentileRank(raw.map((x) => x.row.tov), r.row.tov)),
                        ctovPct: Math.round(100 - percentileRank(raw.map((x) => x.cTov), r.cTov)),
                    },
                },
            });
        }
    }
    return output;
}
function computeTeamForm(players) {
    if (players.length === 0)
        return 50;
    const avgOverall = players.reduce((sum, p) => sum + p.overall, 0) / players.length;
    const avgDpm = players.reduce((sum, p) => sum + p.dpm, 0) / players.length;
    return Math.round(clamp(avgOverall + avgDpm * 3, 0, 100));
}
//# sourceMappingURL=impactRatings.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTeamCodeForPositions = mapTeamCodeForPositions;
exports.normalizeDetailedPos = normalizeDetailedPos;
exports.getDetailedPositionIndex = getDetailedPositionIndex;
exports.resolveDetailedPosition = resolveDetailedPosition;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const sync_1 = require("csv-parse/sync");
const loadSalariesRoster_1 = require("./loadSalariesRoster");
let cache = null;
function mapTeamCodeForPositions(input) {
    const v = String(input ?? "").trim().toUpperCase();
    const aliases = { BRK: "BKN", PHO: "PHX", CHO: "CHA", GS: "GSW", SA: "SAS", NO: "NOP", NY: "NYK" };
    return aliases[v] ?? v;
}
function normalizeDetailedPos(raw) {
    const v = String(raw ?? "").toUpperCase().replace(/\s+/g, "");
    if (!v)
        return null;
    if (["PG", "SG", "SF", "PF", "C"].includes(v))
        return v;
    const parts = v.split(/[-/]/).filter(Boolean);
    for (const token of ["PG", "SG", "SF", "PF", "C"]) {
        if (parts.includes(token) || v.includes(token))
            return token;
    }
    if (v === "G")
        return "SG";
    if (v === "F")
        return "SF";
    return null;
}
function getDetailedPositionIndex() {
    if (cache)
        return cache;
    const preferred = node_path_1.default.resolve(process.cwd(), "data", "Advanced.csv");
    const fallback = node_path_1.default.resolve(process.cwd(), "data", "full_stats.csv");
    const csvPath = node_fs_1.default.existsSync(preferred) ? preferred : fallback;
    if (!node_fs_1.default.existsSync(csvPath)) {
        cache = { byNameTeam: new Map(), byName: new Map() };
        return cache;
    }
    const rows = (0, sync_1.parse)(node_fs_1.default.readFileSync(csvPath, "utf8"), {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        trim: true,
    });
    const byNameTeamCount = new Map();
    const byNameCount = new Map();
    for (const row of rows) {
        const rawName = String(row.player ?? row.Player ?? "").trim();
        const rawTeam = String(row.team ?? row.Team ?? row.Tm ?? "").trim();
        const rawPos = String(row.pos ?? row.Pos ?? row.Position ?? "").trim();
        if (!rawName || !rawPos)
            continue;
        const name = (0, loadSalariesRoster_1.normalizePlayerName)(rawName);
        const team = mapTeamCodeForPositions(rawTeam);
        const pos = normalizeDetailedPos(rawPos);
        if (!name || !pos)
            continue;
        const teamKey = `${name}|${team}`;
        const teamMap = byNameTeamCount.get(teamKey) ?? new Map();
        teamMap.set(pos, (teamMap.get(pos) ?? 0) + 1);
        byNameTeamCount.set(teamKey, teamMap);
        const nameMap = byNameCount.get(name) ?? new Map();
        nameMap.set(pos, (nameMap.get(pos) ?? 0) + 1);
        byNameCount.set(name, nameMap);
    }
    const pickTop = (countMap) => {
        let best = "";
        let bestCount = -1;
        for (const [pos, count] of countMap.entries()) {
            if (count > bestCount) {
                best = pos;
                bestCount = count;
            }
        }
        return best || null;
    };
    const byNameTeam = new Map();
    const byName = new Map();
    for (const [key, countMap] of byNameTeamCount.entries()) {
        const top = pickTop(countMap);
        if (top)
            byNameTeam.set(key, top);
    }
    for (const [key, countMap] of byNameCount.entries()) {
        const top = pickTop(countMap);
        if (top)
            byName.set(key, top);
    }
    cache = { byNameTeam, byName };
    return cache;
}
function resolveDetailedPosition(playerName, teamCode, currentPosition) {
    const index = getDetailedPositionIndex();
    const name = (0, loadSalariesRoster_1.normalizePlayerName)(String(playerName ?? ""));
    if (!name)
        return null;
    const team = mapTeamCodeForPositions(String(teamCode ?? ""));
    const detailed = index.byNameTeam.get(`${name}|${team}`) ?? index.byName.get(name) ?? null;
    if (!detailed)
        return null;
    return detailed;
}
//# sourceMappingURL=loadDetailedPositions.js.map
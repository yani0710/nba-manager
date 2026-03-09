"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAYER_ALIASES = void 0;
exports.normalizePlayerName = normalizePlayerName;
exports.loadSalariesRosterRows = loadSalariesRosterRows;
exports.buildTeamRoster = buildTeamRoster;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const sync_1 = require("csv-parse/sync");
const PLAYER_ALIASES = {
    "dennis schroder": "dennis schröder",
    "luka doncic": "luka dončić",
};
exports.PLAYER_ALIASES = PLAYER_ALIASES;
function toCsvRows(filePath) {
    const csv = node_fs_1.default.readFileSync(filePath, "utf8");
    return (0, sync_1.parse)(csv, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        trim: true,
    });
}
function dataDir() {
    return node_path_1.default.resolve(process.cwd(), "data");
}
function findSalariesCsv() {
    const preferred = node_path_1.default.join(dataDir(), "nba_salaries_clean.csv");
    if (node_fs_1.default.existsSync(preferred))
        return preferred;
    const files = node_fs_1.default.readdirSync(dataDir()).filter((f) => f.toLowerCase().endsWith(".csv"));
    for (const file of files) {
        const firstLine = node_fs_1.default.readFileSync(node_path_1.default.join(dataDir(), file), "utf8").split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
        if (firstLine.includes("player") && firstLine.includes("team") && firstLine.includes("salary")) {
            return node_path_1.default.join(dataDir(), file);
        }
    }
    throw new Error("nba_salaries_clean.csv not found (or no salary CSV with Player/Team/Salary headers found)");
}
function normalizePlayerName(input) {
    const base = String(input ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const alias = PLAYER_ALIASES[base];
    if (!alias)
        return base;
    // Normalize alias target once and stop. This avoids alias loops caused by mojibake variants
    // collapsing back to the same normalized key (e.g. "schrГ¶der" -> "schroder").
    const normalizedAlias = String(alias)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return normalizedAlias || base;
}
function toInt(value) {
    const cleaned = String(value ?? "").replace(/[^\d.-]/g, "").trim();
    if (!cleaned)
        return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}
function getSeasonColumns(row) {
    const cols = [];
    for (const [key, raw] of Object.entries(row)) {
        const m = key.trim().match(/^(\d{4})[-/](\d{2})$/);
        if (!m)
            continue;
        const startYear = Number(m[1]);
        const endYear = 2000 + Number(m[2]);
        const value = toInt(raw) ?? 0;
        if (value > 0)
            cols.push({ key, startYear, endYear, value });
    }
    cols.sort((a, b) => a.startYear - b.startYear);
    return cols;
}
function mapTeamCode(input) {
    const v = String(input ?? "").trim().toUpperCase();
    const aliases = { BRK: "BKN", PHO: "PHX", CHO: "CHA", GS: "GSW", SA: "SAS", NO: "NOP", NY: "NYK" };
    return aliases[v] ?? v;
}
function pickField(row, candidates) {
    for (const key of Object.keys(row)) {
        const normalized = key.toLowerCase().replace(/\s+/g, "");
        if (candidates.some((c) => normalized === c || normalized.includes(c))) {
            return row[key];
        }
    }
    return "";
}
function loadSalariesRosterRows() {
    const filePath = findSalariesCsv();
    const rawRows = toCsvRows(filePath);
    const rows = rawRows
        .map((row) => {
        const rawName = pickField(row, ["player", "name"]).trim();
        const teamCode = mapTeamCode(pickField(row, ["team", "teamabbr", "teamcode"]).trim());
        const seasonCols = getSeasonColumns(row);
        const salary = toInt(pickField(row, ["salary", "yearlysalary", "amount"])) ??
            seasonCols[0]?.value ??
            null;
        const contractEndYear = toInt(pickField(row, ["contractend", "expiry", "endyear", "expyear"])) ??
            seasonCols[seasonCols.length - 1]?.endYear ??
            null;
        const guaranteed = toInt(pickField(row, ["guaranteed", "guaranteedmoney"]));
        const season = pickField(row, ["season", "year"]) || (seasonCols[0] ? `${seasonCols[0].startYear}-${String(seasonCols[0].endYear).slice(-2)}` : "");
        return {
            rawName,
            normalizedName: normalizePlayerName(rawName),
            teamCode,
            salary,
            contractEndYear,
            guaranteed,
            season: season || null,
            sourceRow: row,
        };
    })
        .filter((r) => r.rawName && r.teamCode);
    return { filePath, rows };
}
function buildTeamRoster() {
    const { filePath, rows } = loadSalariesRosterRows();
    const byTeam = new Map();
    for (const row of rows) {
        const arr = byTeam.get(row.teamCode) ?? [];
        // Prevent accidental duplicates from multiple lines per same team/name; keep highest salary row.
        const existingIdx = arr.findIndex((p) => p.normalizedName === row.normalizedName);
        if (existingIdx >= 0) {
            const existing = arr[existingIdx];
            const existingSalary = existing.salary ?? -1;
            const nextSalary = row.salary ?? -1;
            if (nextSalary >= existingSalary)
                arr[existingIdx] = row;
        }
        else {
            arr.push(row);
        }
        byTeam.set(row.teamCode, arr);
    }
    return { filePath, teamRoster: byTeam, players: [...byTeam.values()].flat() };
}
//# sourceMappingURL=loadSalariesRoster.js.map
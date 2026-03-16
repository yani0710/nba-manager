"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFixturesFromCsv = loadFixturesFromCsv;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const sync_1 = require("csv-parse/sync");
const ET_ZONE = "America/New_York";
const MONTH_LOOKUP = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
};
const CSV_TEAM_NAME_TO_SHORT = {
    "Atlanta Hawks": "ATL",
    "Boston Celtics": "BOS",
    "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA",
    "Chicago Bulls": "CHI",
    "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL",
    "Denver Nuggets": "DEN",
    "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW",
    "Houston Rockets": "HOU",
    "Indiana Pacers": "IND",
    "Los Angeles Clippers": "LAC",
    "LA Clippers": "LAC",
    "Los Angeles Lakers": "LAL",
    "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA",
    "Milwaukee Bucks": "MIL",
    "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP",
    "New York Knicks": "NYK",
    "Oklahoma City Thunder": "OKC",
    "Orlando Magic": "ORL",
    "Philadelphia 76ers": "PHI",
    "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR",
    "Sacramento Kings": "SAC",
    "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR",
    "Utah Jazz": "UTA",
    "Washington Wizards": "WAS",
};
const ET_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_ZONE,
    timeZoneName: "shortOffset",
});
function normalizeName(input) {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, "")
        .replace(/\s+/g, " ");
}
function parseCsvDate(rawDate) {
    const cleaned = rawDate.replace(/^[A-Za-z]{3}\s+/, "").trim();
    const match = cleaned.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/);
    if (!match)
        return null;
    const month = MONTH_LOOKUP[match[1]];
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (!month || !Number.isFinite(day) || !Number.isFinite(year))
        return null;
    return { year, month, day };
}
function parseStartTimeEt(rawStart) {
    const match = rawStart.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?([ap])$/);
    if (!match)
        return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? "0");
    const meridiem = match[3];
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59)
        return null;
    if (meridiem === "p" && hour !== 12)
        hour += 12;
    if (meridiem === "a" && hour === 12)
        hour = 0;
    return { hour, minute };
}
function parseNumeric(value) {
    if (value == null)
        return null;
    const raw = String(value).trim();
    if (raw.length === 0)
        return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
function toEtOffset(dateInUtc) {
    const part = ET_OFFSET_FORMATTER
        .formatToParts(dateInUtc)
        .find((p) => p.type === "timeZoneName")
        ?.value;
    const match = part?.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!match)
        return "-05:00";
    const sign = match[1];
    const hh = match[2].padStart(2, "0");
    const mm = (match[3] ?? "00").padStart(2, "0");
    return `${sign}${hh}:${mm}`;
}
function etDateTimeToUtc(year, month, day, hour, minute) {
    const probeUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const offset = toEtOffset(probeUtc);
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`;
    return new Date(iso);
}
function isDateInNbaSeason(year, month, season) {
    const startYear = Number(String(season).slice(0, 4));
    if (!Number.isFinite(startYear))
        return true;
    return (year === startYear && month >= 7) || (year === startYear + 1 && month <= 6);
}
function loadFixturesFromCsv(params) {
    const csvPath = params.csvPath
        ?? node_path_1.default.resolve(__dirname, "..", "..", "..", "data", "fixtures.csv");
    if (!node_fs_1.default.existsSync(csvPath)) {
        return {
            fixtures: [],
            report: {
                rowsRead: 0,
                rowsForSeason: 0,
                skippedRows: 0,
                duplicateRows: 0,
                mappedTeams: 0,
                unmappedTeams: [`fixtures.csv not found at ${csvPath}`],
                fields: [],
            },
        };
    }
    const raw = node_fs_1.default.readFileSync(csvPath, "utf8");
    const rows = (0, sync_1.parse)(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
        bom: true,
    });
    const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
    const teamIdByShort = new Map(params.teams.map((team) => [team.shortName.toUpperCase(), team.id]));
    const shortByName = new Map(params.teams.map((team) => [normalizeName(team.name), team.shortName.toUpperCase()]));
    const output = [];
    const seen = new Set();
    const unmappedTeams = new Set();
    let rowsForSeason = 0;
    let skippedRows = 0;
    let duplicateRows = 0;
    let mappedTeams = 0;
    for (const row of rows) {
        const dateText = String(row.Date ?? "").trim();
        const startEt = String(row["Start (ET)"] ?? "").trim();
        const awayName = String(row["Visitor/Neutral"] ?? "").trim();
        const homeName = String(row["Home/Neutral"] ?? "").trim();
        if (!dateText || !startEt || !awayName || !homeName) {
            skippedRows += 1;
            continue;
        }
        const parsedDate = parseCsvDate(dateText);
        const parsedTime = parseStartTimeEt(startEt);
        if (!parsedDate || !parsedTime) {
            skippedRows += 1;
            continue;
        }
        if (!isDateInNbaSeason(parsedDate.year, parsedDate.month, params.season)) {
            continue;
        }
        rowsForSeason += 1;
        const awayShort = CSV_TEAM_NAME_TO_SHORT[awayName]
            ?? shortByName.get(normalizeName(awayName))
            ?? null;
        const homeShort = CSV_TEAM_NAME_TO_SHORT[homeName]
            ?? shortByName.get(normalizeName(homeName))
            ?? null;
        const awayTeamId = awayShort ? teamIdByShort.get(awayShort) : undefined;
        const homeTeamId = homeShort ? teamIdByShort.get(homeShort) : undefined;
        if (!awayTeamId)
            unmappedTeams.add(awayName);
        if (!homeTeamId)
            unmappedTeams.add(homeName);
        if (!awayTeamId || !homeTeamId) {
            skippedRows += 1;
            continue;
        }
        mappedTeams += 2;
        const gameDate = etDateTimeToUtc(parsedDate.year, parsedDate.month, parsedDate.day, parsedTime.hour, parsedTime.minute);
        if (Number.isNaN(gameDate.getTime())) {
            skippedRows += 1;
            continue;
        }
        const dedupeKey = [
            parsedDate.year,
            parsedDate.month,
            parsedDate.day,
            parsedTime.hour,
            parsedTime.minute,
            awayTeamId,
            homeTeamId,
        ].join("|");
        if (seen.has(dedupeKey)) {
            duplicateRows += 1;
            continue;
        }
        seen.add(dedupeKey);
        output.push({
            homeTeamId,
            awayTeamId,
            gameDate,
            status: "scheduled",
            homeScore: 0,
            awayScore: 0,
            source: {
                dateText,
                startEt,
                homeTeamName: homeName,
                awayTeamName: awayName,
                sourceHomeScore: parseNumeric(row["PTS.1"]),
                sourceAwayScore: parseNumeric(row.PTS),
                arena: row.Arena?.trim() || null,
                notes: row.Notes?.trim() || null,
            },
        });
    }
    output.sort((a, b) => a.gameDate.getTime() - b.gameDate.getTime() || a.homeTeamId - b.homeTeamId || a.awayTeamId - b.awayTeamId);
    return {
        fixtures: output,
        report: {
            rowsRead: rows.length,
            rowsForSeason,
            skippedRows,
            duplicateRows,
            mappedTeams,
            unmappedTeams: [...unmappedTeams].sort(),
            fields,
        },
    };
}
//# sourceMappingURL=fixtureCsvLoader.js.map
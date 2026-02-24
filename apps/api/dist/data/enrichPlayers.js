"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichPlayersFromSalariesRoster = enrichPlayersFromSalariesRoster;
const prisma_1 = __importDefault(require("../config/prisma"));
const loadSalariesRoster_1 = require("./loadSalariesRoster");
function mapTeamCode(v) {
    const aliases = { BRK: "BKN", PHO: "PHX", CHO: "CHA", GS: "GSW", SA: "SAS", NO: "NOP", NY: "NYK" };
    return aliases[String(v ?? "").toUpperCase()] ?? String(v ?? "").toUpperCase();
}
async function enrichPlayersFromSalariesRoster() {
    const { filePath, teamRoster, players: salaryPlayers } = (0, loadSalariesRoster_1.buildTeamRoster)();
    const dbPlayers = await prisma_1.default.player.findMany({
        where: { active: true },
        include: { team: true, contracts: true },
        orderBy: { name: "asc" },
    });
    const byExternal = new Map();
    const byName = new Map();
    const byNameTeam = new Map();
    for (const p of dbPlayers) {
        if (p.externalRef)
            byExternal.set(String(p.externalRef), p);
        const n = (0, loadSalariesRoster_1.normalizePlayerName)(p.name);
        const t = mapTeamCode(p.team?.shortName ?? "");
        byName.set(n, [...(byName.get(n) ?? []), p]);
        byNameTeam.set(`${n}|${t}`, [...(byNameTeam.get(`${n}|${t}`) ?? []), p]);
    }
    const ambiguousWarnings = [];
    const missingSample = [];
    let matchedInDb = 0;
    const enrichRow = (row) => {
        const byTeamCandidates = byNameTeam.get(`${row.normalizedName}|${row.teamCode}`) ?? [];
        let matched = byTeamCandidates[0] ?? null;
        let warning;
        if (!matched) {
            const nameCandidates = byName.get(row.normalizedName) ?? [];
            if (nameCandidates.length > 1) {
                warning = `ambiguous:${row.rawName}|${row.teamCode}|${nameCandidates.map((p) => `${p.name}/${p.team.shortName}`).join(",")}`;
                ambiguousWarnings.push(warning);
            }
            matched = nameCandidates[0] ?? null;
        }
        if (!matched) {
            if (missingSample.length < 20)
                missingSample.push(`${row.rawName} (${row.teamCode})`);
            return {
                rosterSource: "nba_salaries_clean.csv",
                rosterName: row.rawName,
                rosterTeamCode: row.teamCode,
                salary: row.salary,
                contractEndYear: row.contractEndYear,
                guaranteed: row.guaranteed,
                enrichmentMatched: false,
                id: null,
                name: row.rawName,
                teamId: null,
                team: null,
                position: null,
                number: null,
                jerseyNumber: null,
                overall: null,
                overallBase: null,
                overallCurrent: null,
                form: null,
                fatigue: null,
                morale: null,
                heightCm: null,
                weightKg: null,
                nationality: null,
                birthDate: null,
                age: null,
                externalRef: null,
            };
        }
        matchedInDb += 1;
        return {
            rosterSource: "nba_salaries_clean.csv",
            rosterName: row.rawName,
            rosterTeamCode: row.teamCode,
            salary: row.salary ?? matched.salary ?? null,
            contractEndYear: row.contractEndYear,
            guaranteed: row.guaranteed,
            enrichmentMatched: true,
            enrichmentWarning: warning,
            id: matched.id,
            name: matched.name,
            teamId: matched.teamId,
            team: matched.team ? { id: matched.team.id, name: matched.team.name, shortName: matched.team.shortName } : null,
            position: matched.position ?? null,
            number: matched.number ?? null,
            jerseyNumber: matched.jerseyNumber ?? null,
            overall: matched.overall ?? null,
            overallBase: matched.overallBase ?? null,
            overallCurrent: matched.overallCurrent ?? null,
            form: matched.form ?? null,
            fatigue: matched.fatigue ?? null,
            morale: matched.morale ?? null,
            heightCm: matched.heightCm ?? null,
            weightKg: matched.weightKg ?? null,
            nationality: matched.nationality ?? null,
            birthDate: matched.birthDate ?? null,
            age: matched.age ?? null,
            externalRef: matched.externalRef ?? null,
            attributes: matched.attributes,
        };
    };
    const enrichedByTeam = new Map();
    for (const [teamCode, rows] of teamRoster.entries()) {
        enrichedByTeam.set(teamCode, rows.map(enrichRow));
    }
    const health = {
        sourceFile: filePath,
        totalPlayersFromSalaries: salaryPlayers.length,
        matchedInDb,
        missingInDb: salaryPlayers.length - matchedInDb,
        missingSample,
        ambiguousWarnings: ambiguousWarnings.slice(0, 20),
    };
    return { byTeam: enrichedByTeam, health };
}
//# sourceMappingURL=enrichPlayers.js.map
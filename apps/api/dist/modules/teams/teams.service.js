"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const enrichPlayers_1 = require("../../data/enrichPlayers");
class TeamsService {
    async getAllTeams(saveId) {
        const salariesRoster = await (0, enrichPlayers_1.enrichPlayersFromSalariesRoster)();
        const teams = await prisma_1.default.team.findMany({
            include: {
                homeGames: true,
                awayGames: true,
            },
            orderBy: { name: "asc" },
        });
        const withRoster = teams.map((team) => ({
            ...team,
            players: salariesRoster.byTeam.get(team.shortName) ?? [],
            rosterMissingEnrichmentCount: (salariesRoster.byTeam.get(team.shortName) ?? []).filter((p) => !p.enrichmentMatched).length,
        }));
        return this.attachTeamState(withRoster, saveId);
    }
    async getTeamById(id, saveId) {
        const salariesRoster = await (0, enrichPlayers_1.enrichPlayersFromSalariesRoster)();
        const team = await prisma_1.default.team.findUnique({
            where: { id },
            include: {
                homeGames: true,
                awayGames: true,
            },
        });
        if (!team)
            return null;
        const [withState] = await this.attachTeamState([{
                ...team,
                players: salariesRoster.byTeam.get(team.shortName) ?? [],
                rosterMissingEnrichmentCount: (salariesRoster.byTeam.get(team.shortName) ?? []).filter((p) => !p.enrichmentMatched).length,
            }], saveId);
        return withState ?? null;
    }
    async getTeamByName(name, saveId) {
        const salariesRoster = await (0, enrichPlayers_1.enrichPlayersFromSalariesRoster)();
        const team = await prisma_1.default.team.findUnique({
            where: { name },
        });
        if (!team)
            return null;
        const [withState] = await this.attachTeamState([{
                ...team,
                players: salariesRoster.byTeam.get(team.shortName) ?? [],
                rosterMissingEnrichmentCount: (salariesRoster.byTeam.get(team.shortName) ?? []).filter((p) => !p.enrichmentMatched).length,
            }], saveId);
        return withState ?? null;
    }
    async getRosterByTeamId(id, saveId) {
        const salariesRoster = await (0, enrichPlayers_1.enrichPlayersFromSalariesRoster)();
        const team = await prisma_1.default.team.findUnique({
            where: { id },
        });
        if (!team) {
            return null;
        }
        const roster = salariesRoster.byTeam.get(team.shortName) ?? [];
        return {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            city: team.city,
            conference: team.conference,
            division: team.division,
            logoPath: team.logoPath,
            roster: roster.slice().sort((a, b) => String(a.position ?? "").localeCompare(String(b.position ?? "")) || a.name.localeCompare(b.name)),
            rosterSource: "nba_salaries_clean.csv",
            rosterEnrichment: {
                total: roster.length,
                missing: roster.filter((p) => !p.enrichmentMatched).length,
            },
            teamState: await this.readSingleTeamState(saveId, team.id),
        };
    }
    async attachTeamState(teams, saveId) {
        if (!saveId || teams.length === 0)
            return teams;
        const save = await prisma_1.default.save.findUnique({
            where: { id: saveId },
            select: { data: true },
        });
        const payload = (save?.data ?? {});
        const teamState = payload.teamState ?? {};
        return teams.map((team) => ({
            ...team,
            form: teamState[String(team.id)]?.form ?? 50,
            last5: teamState[String(team.id)]?.last5 ?? "",
            streak: teamState[String(team.id)]?.streak ?? 0,
            offenseRating: teamState[String(team.id)]?.offenseRating ?? 75,
            defenseRating: teamState[String(team.id)]?.defenseRating ?? 75,
        }));
    }
    async readSingleTeamState(saveId, teamId) {
        if (!saveId)
            return { form: 50, last5: "", streak: 0, offenseRating: 75, defenseRating: 75 };
        const save = await prisma_1.default.save.findUnique({ where: { id: saveId }, select: { data: true } });
        const payload = (save?.data ?? {});
        const entry = payload.teamState?.[String(teamId)];
        return {
            form: entry?.form ?? 50,
            last5: entry?.last5 ?? "",
            streak: entry?.streak ?? 0,
            offenseRating: entry?.offenseRating ?? 75,
            defenseRating: entry?.defenseRating ?? 75,
        };
    }
}
exports.TeamsService = TeamsService;
//# sourceMappingURL=teams.service.js.map
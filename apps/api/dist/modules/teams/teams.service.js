"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const loadDetailedPositions_1 = require("../../data/loadDetailedPositions");
const FREE_AGENT_TEAM_SHORT = "FA";
const contractSelect = {
    id: true,
    playerId: true,
    salary: true,
    startYear: true,
    endYear: true,
    averageAnnualValue: true,
    currentYearSalary: true,
    contractType: true,
    createdAt: true,
    updatedAt: true,
    contractYears: true,
};
class TeamsService {
    async getAllTeams(saveId) {
        const teams = await prisma_1.default.team.findMany({
            where: { shortName: { not: FREE_AGENT_TEAM_SHORT } },
            include: {
                homeGames: true,
                awayGames: true,
            },
            orderBy: { name: "asc" },
        });
        const rosterByTeamId = await this.buildRosterByTeamId(saveId, teams.map((t) => t.id));
        const withRoster = teams.map((team) => ({
            ...team,
            players: rosterByTeamId.get(team.id) ?? [],
            rosterMissingEnrichmentCount: 0,
        }));
        return this.attachTeamState(withRoster, saveId);
    }
    async getTeamById(id, saveId) {
        const team = await prisma_1.default.team.findFirst({
            where: { id, shortName: { not: FREE_AGENT_TEAM_SHORT } },
            include: {
                homeGames: true,
                awayGames: true,
            },
        });
        if (!team)
            return null;
        const rosterByTeamId = await this.buildRosterByTeamId(saveId, [team.id]);
        const [withState] = await this.attachTeamState([{
                ...team,
                players: rosterByTeamId.get(team.id) ?? [],
                rosterMissingEnrichmentCount: 0,
            }], saveId);
        return withState ?? null;
    }
    async getTeamByName(name, saveId) {
        const team = await prisma_1.default.team.findFirst({
            where: { name, shortName: { not: FREE_AGENT_TEAM_SHORT } },
        });
        if (!team)
            return null;
        const rosterByTeamId = await this.buildRosterByTeamId(saveId, [team.id]);
        const [withState] = await this.attachTeamState([{
                ...team,
                players: rosterByTeamId.get(team.id) ?? [],
                rosterMissingEnrichmentCount: 0,
            }], saveId);
        return withState ?? null;
    }
    async getRosterByTeamId(id, saveId) {
        const team = await prisma_1.default.team.findFirst({
            where: { id, shortName: { not: FREE_AGENT_TEAM_SHORT } },
        });
        if (!team)
            return null;
        const rosterByTeamId = await this.buildRosterByTeamId(saveId, [team.id]);
        const roster = rosterByTeamId.get(team.id) ?? [];
        return {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            city: team.city,
            conference: team.conference,
            division: team.division,
            logoPath: team.logoPath,
            roster: roster.slice().sort((a, b) => String(a.position ?? "").localeCompare(String(b.position ?? "")) || a.name.localeCompare(b.name)),
            rosterSource: "database.players",
            rosterEnrichment: {
                total: roster.length,
                missing: 0,
            },
            teamState: await this.readSingleTeamState(saveId, team.id),
        };
    }
    resolveSalary(player) {
        const direct = Number(player.salary);
        if (Number.isFinite(direct) && direct > 0)
            return direct;
        const c = player.contracts;
        const currentYear = Number(c?.currentYearSalary);
        if (Number.isFinite(currentYear) && currentYear > 0)
            return currentYear;
        const baseSalary = Number(c?.salary);
        if (Number.isFinite(baseSalary) && baseSalary > 0)
            return baseSalary;
        const aav = Number(c?.averageAnnualValue);
        if (Number.isFinite(aav) && aav > 0)
            return aav;
        const years = Array.isArray(c?.contractYears) ? c.contractYears : [];
        const firstYear = years
            .map((row) => Number(row?.salary))
            .find((n) => Number.isFinite(n) && n > 0);
        if (firstYear != null && Number.isFinite(firstYear) && firstYear > 0)
            return firstYear;
        return null;
    }
    async buildRosterByTeamId(saveId, teamIds) {
        const [players, teams, save] = await Promise.all([
            prisma_1.default.player.findMany({
                where: { active: true },
                include: {
                    team: true,
                    contracts: { select: contractSelect },
                },
                orderBy: [{ overallCurrent: "desc" }, { overall: "desc" }, { name: "asc" }],
            }),
            prisma_1.default.team.findMany({
                where: { shortName: { not: FREE_AGENT_TEAM_SHORT } },
                select: { id: true, shortName: true, name: true, city: true },
            }),
            saveId
                ? prisma_1.default.save.findUnique({ where: { id: saveId }, select: { data: true } })
                : Promise.resolve(null),
        ]);
        const payload = (save?.data ?? {});
        const overrides = payload.transferState?.playerTeamOverrides ?? {};
        const teamById = new Map(teams.map((t) => [t.id, t]));
        const allowed = teamIds ? new Set(teamIds) : null;
        const grouped = new Map();
        for (const player of players) {
            const overrideTeamId = overrides[String(player.id)];
            const effectiveTeamId = Number(overrideTeamId ?? player.teamId);
            if (!Number.isFinite(effectiveTeamId))
                continue;
            if (allowed && !allowed.has(effectiveTeamId))
                continue;
            const targetTeam = teamById.get(effectiveTeamId);
            if (!targetTeam)
                continue;
            const list = grouped.get(effectiveTeamId) ?? [];
            list.push({
                ...player,
                teamId: effectiveTeamId,
                position: (0, loadDetailedPositions_1.resolveDetailedPosition)(player.name, targetTeam.shortName, player.position) ?? player.position,
                primaryPosition: (0, loadDetailedPositions_1.resolveDetailedPosition)(player.name, targetTeam.shortName, player.primaryPosition ?? player.position) ?? player.primaryPosition ?? player.position,
                team: {
                    ...(player.team ?? {}),
                    id: targetTeam.id,
                    shortName: targetTeam.shortName,
                    name: targetTeam.name,
                    city: targetTeam.city,
                },
                salary: this.resolveSalary(player),
            });
            grouped.set(effectiveTeamId, list);
        }
        for (const [teamId, roster] of grouped.entries()) {
            grouped.set(teamId, roster.sort((a, b) => {
                const parseJersey = (p) => {
                    const code = String(p.jerseyCode ?? "").trim();
                    if (code) {
                        const n = Number(code);
                        if (Number.isFinite(n))
                            return n;
                    }
                    return p.jerseyNumber ?? p.number ?? 999;
                };
                const anum = parseJersey(a);
                const bnum = parseJersey(b);
                return anum - bnum || String(a.name).localeCompare(String(b.name));
            }));
        }
        return grouped;
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
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayersService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const enrichPlayers_1 = require("../../data/enrichPlayers");
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
class PlayersService {
    async getPlayersByTeamId(teamId, includeInactive = false, saveId) {
        const team = await prisma_1.default.team.findUnique({ where: { id: teamId }, select: { id: true, shortName: true } });
        if (!team)
            return [];
        const salariesRoster = await (0, enrichPlayers_1.enrichPlayersFromSalariesRoster)();
        const roster = salariesRoster.byTeam.get(team.shortName) ?? [];
        const filtered = includeInactive ? roster : roster;
        return this.attachSaveStateToRoster(filtered, saveId);
    }
    async getPlayerById(id, saveId) {
        const player = await prisma_1.default.player.findUnique({
            where: { id },
            include: {
                team: true,
                contracts: { select: contractSelect },
                gameStats: true,
                seasonImpact: {
                    orderBy: { season: "desc" },
                    take: 1,
                },
            },
        });
        if (!player)
            return null;
        const [withState] = await this.attachSaveState([player], saveId);
        if (!withState)
            return null;
        return {
            ...withState,
            scouting: this.buildStrengthsWeaknesses(withState.attributes),
        };
    }
    async getAllPlayers(take, includeInactive = false, saveId) {
        const players = await prisma_1.default.player.findMany({
            where: includeInactive ? {} : { active: true },
            include: {
                team: true,
                contracts: { select: contractSelect },
            },
            orderBy: { name: "asc" },
            ...(take ? { take } : {}),
        });
        return this.attachSaveState(players, saveId);
    }
    async getPlayerStats(playerId, saveId) {
        const where = {
            playerId,
            ...(saveId ? { game: { saveId } } : {}),
        };
        const [games, grouped, lastFive] = await Promise.all([
            prisma_1.default.gameStat.count({ where }),
            prisma_1.default.gameStat.aggregate({
                where,
                _sum: { points: true, rebounds: true, assists: true },
            }),
            prisma_1.default.gameStat.findMany({
                where,
                include: { game: true },
                orderBy: { game: { gameDate: "desc" } },
                take: 5,
            }),
        ]);
        const safeGames = Math.max(1, games);
        return {
            gamesPlayed: games,
            totals: {
                points: grouped._sum.points ?? 0,
                rebounds: grouped._sum.rebounds ?? 0,
                assists: grouped._sum.assists ?? 0,
            },
            averages: {
                points: Number(((grouped._sum.points ?? 0) / safeGames).toFixed(1)),
                rebounds: Number(((grouped._sum.rebounds ?? 0) / safeGames).toFixed(1)),
                assists: Number(((grouped._sum.assists ?? 0) / safeGames).toFixed(1)),
            },
            lastFive: lastFive.map((row) => ({
                gameId: row.gameId,
                date: row.game.gameDate,
                points: row.points,
                rebounds: row.rebounds,
                assists: row.assists,
            })),
        };
    }
    async attachSaveState(players, saveId) {
        if (!saveId || players.length === 0)
            return players;
        const save = await prisma_1.default.save.findUnique({
            where: { id: saveId },
            select: { data: true },
        });
        const payload = (save?.data ?? {});
        const playerState = payload.playerState ?? {};
        return players.map((player) => {
            const state = playerState[String(player.id)];
            const currentOverall = state?.effectiveOverall
                ?? player.overallCurrent
                ?? player.overall;
            return {
                ...player,
                form: state?.form ?? player.form ?? 60,
                fatigue: state?.fatigue ?? 10,
                morale: state?.morale ?? 65,
                overall: currentOverall,
                overallCurrent: currentOverall,
                effectiveOverall: currentOverall,
            };
        });
    }
    async attachSaveStateToRoster(players, saveId) {
        if (!saveId || players.length === 0)
            return players;
        const save = await prisma_1.default.save.findUnique({ where: { id: saveId }, select: { data: true } });
        const payload = (save?.data ?? {});
        const playerState = payload.playerState ?? {};
        return players.map((player) => {
            if (!player.id)
                return player;
            const state = playerState[String(player.id)];
            const currentOverall = state?.effectiveOverall ?? player.overallCurrent ?? player.overall ?? null;
            return {
                ...player,
                form: state?.form ?? player.form ?? null,
                fatigue: state?.fatigue ?? player.fatigue ?? null,
                morale: state?.morale ?? player.morale ?? null,
                overall: currentOverall,
                overallCurrent: currentOverall,
                effectiveOverall: currentOverall,
            };
        });
    }
    buildStrengthsWeaknesses(attributes) {
        const attr = (attributes ?? {});
        const candidates = [];
        const push = (key, label, value) => {
            if (typeof value === "number")
                candidates.push({ key, label, value });
        };
        push("att", "Scoring pressure", attr.att);
        push("play", "On-ball creation", attr.play);
        push("def", "Defensive impact", attr.def);
        push("phy", "Physical profile", attr.phy);
        push("iq", "Game IQ", attr.iq);
        const sorted = [...candidates].sort((a, b) => b.value - a.value);
        const strengths = sorted.slice(0, 3).map((s) => s.label);
        const weaknesses = sorted.slice(-2).map((s) => s.label);
        return { strengths, weaknesses };
    }
}
exports.PlayersService = PlayersService;
//# sourceMappingURL=players.service.js.map
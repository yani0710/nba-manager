"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayersService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const enrichPlayers_1 = require("../../data/enrichPlayers");
const loadSalariesRoster_1 = require("../../data/loadSalariesRoster");
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
        const players = await prisma_1.default.player.findMany({
            where: {
                teamId,
                ...(includeInactive ? {} : { active: true }),
            },
            include: {
                team: true,
                contracts: { select: contractSelect },
            },
            orderBy: [{ overallCurrent: "desc" }, { overall: "desc" }, { name: "asc" }],
        });
        const withState = await this.attachSaveState(players, saveId);
        const withOverrides = await this.attachTransferOverridesToPlayers(withState, saveId);
        return this.applySalaryFallbackFromRoster(withOverrides);
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
        const [withTransferOverride] = await this.attachTransferOverridesToPlayers([withState], saveId);
        return {
            ...(withTransferOverride ?? withState),
            scouting: this.buildStrengthsWeaknesses((withTransferOverride ?? withState).attributes),
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
        const withState = await this.attachSaveState(players, saveId);
        const withOverrides = await this.attachTransferOverridesToPlayers(withState, saveId);
        return this.applySalaryFallbackFromRoster(withOverrides);
    }
    async applySalaryFallbackFromRoster(players) {
        if (!players || players.length === 0)
            return players;
        const needsFallback = players.some((p) => !Number.isFinite(Number(p.salary)) || Number(p.salary) <= 0);
        if (!needsFallback)
            return players;
        const roster = await (0, enrichPlayers_1.enrichPlayersFromSalariesRoster)();
        const byId = new Map();
        const byNameTeam = new Map();
        const byName = new Map();
        for (const teamRows of roster.byTeam.values()) {
            for (const row of teamRows) {
                const salary = Number(row.salary);
                if (!Number.isFinite(salary) || salary <= 0)
                    continue;
                if (Number.isFinite(Number(row.id))) {
                    const id = Number(row.id);
                    const prev = byId.get(id) ?? -1;
                    if (salary > prev)
                        byId.set(id, salary);
                }
                const key = `${(0, loadSalariesRoster_1.normalizePlayerName)(String(row.name ?? row.rosterName ?? ""))}|${String(row.team?.shortName ?? row.rosterTeamCode ?? "").toUpperCase()}`;
                if (key !== "|") {
                    const prev = byNameTeam.get(key) ?? -1;
                    if (salary > prev)
                        byNameTeam.set(key, salary);
                }
                const nameKey = (0, loadSalariesRoster_1.normalizePlayerName)(String(row.name ?? row.rosterName ?? ""));
                if (nameKey) {
                    const prev = byName.get(nameKey) ?? -1;
                    if (salary > prev)
                        byName.set(nameKey, salary);
                }
            }
        }
        return players.map((player) => {
            const current = Number(player.salary);
            const byIdSalary = byId.get(Number(player.id));
            const key = `${(0, loadSalariesRoster_1.normalizePlayerName)(String(player.name ?? ""))}|${String(player.team?.shortName ?? "").toUpperCase()}`;
            const byNameSalary = byNameTeam.get(key);
            const nameOnlySalary = byName.get((0, loadSalariesRoster_1.normalizePlayerName)(String(player.name ?? "")));
            const nextSalary = (Number.isFinite(byIdSalary) && byIdSalary > 0)
                ? byIdSalary
                : (Number.isFinite(byNameSalary) && byNameSalary > 0
                    ? byNameSalary
                    : (Number.isFinite(nameOnlySalary) && nameOnlySalary > 0 ? nameOnlySalary : current));
            return {
                ...player,
                salary: Number.isFinite(nextSalary) && Number(nextSalary) > 0 ? Number(nextSalary) : (Number.isFinite(current) ? current : null),
            };
        });
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
    async attachTransferOverridesToPlayers(players, saveId) {
        if (!saveId || players.length === 0)
            return players;
        const [save, teams] = await Promise.all([
            prisma_1.default.save.findUnique({ where: { id: saveId }, select: { data: true } }),
            prisma_1.default.team.findMany({ select: { id: true, shortName: true, name: true, city: true } }),
        ]);
        const payload = (save?.data ?? {});
        const overrides = payload.transferState?.playerTeamOverrides ?? {};
        if (Object.keys(overrides).length === 0)
            return players;
        const teamById = new Map(teams.map((t) => [t.id, t]));
        return players.map((player) => {
            const overrideTeamId = overrides[String(player.id)];
            if (!overrideTeamId)
                return player;
            const team = teamById.get(Number(overrideTeamId));
            if (!team)
                return player;
            return {
                ...player,
                teamId: team.id,
                team: {
                    ...(player.team ?? {}),
                    id: team.id,
                    shortName: team.shortName,
                    name: team.name,
                    city: team.city,
                },
            };
        });
    }
    async buildRosterOverridesByTeam(saveId, teams, baseByTeam) {
        if (!saveId)
            return new Map();
        const save = await prisma_1.default.save.findUnique({ where: { id: saveId }, select: { data: true } });
        const payload = (save?.data ?? {});
        const overrides = payload.transferState?.playerTeamOverrides ?? {};
        if (Object.keys(overrides).length === 0)
            return new Map();
        const teamCodeById = new Map(teams.map((t) => [t.id, t.shortName]));
        const all = [...baseByTeam.entries()].flatMap(([code, roster]) => roster.map((p) => ({ ...p, rosterTeamCode: p.rosterTeamCode ?? code })));
        const byPlayerId = new Map(all.filter((p) => p.id != null).map((p) => [p.id, p]));
        const out = new Map();
        for (const [code, roster] of baseByTeam.entries())
            out.set(code, [...roster]);
        for (const [playerIdKey, newTeamId] of Object.entries(overrides)) {
            const playerId = Number(playerIdKey);
            const targetCode = teamCodeById.get(Number(newTeamId));
            const player = byPlayerId.get(playerId);
            if (!player || !targetCode)
                continue;
            for (const [code, roster] of out.entries())
                out.set(code, roster.filter((p) => p.id !== playerId));
            out.set(targetCode, [...(out.get(targetCode) ?? []), { ...player, rosterTeamCode: targetCode, teamId: Number(newTeamId) }]);
        }
        return out;
    }
}
exports.PlayersService = PlayersService;
//# sourceMappingURL=players.service.js.map
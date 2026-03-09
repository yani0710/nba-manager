"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavesService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../common/errors/AppError");
const scheduleGenerator_1 = require("../../engine/calendar/scheduleGenerator");
const advanceDay_1 = require("../../engine/calendar/advanceDay");
const simulateGame_1 = require("../../engine/simulation/simulateGame");
const trades_service_1 = require("../trades/trades.service");
class SavesService {
    constructor() {
        this.tradesService = new trades_service_1.TradesService();
    }
    async createSave(dto) {
        if (!dto.name) {
            throw new AppError_1.BadRequestError("Save name is required");
        }
        const season = dto.season ?? "2025-26";
        const seasonStartYear = Number(season.split("-")[0]) || 2025;
        const startDate = dto.startDate ?? `${seasonStartYear}-10-01`;
        const managerName = dto.managerName?.trim() || "Unknown Manager";
        const username = dto.username?.trim() || "user";
        const coachAvatar = dto.coachAvatar ?? "spoelstra";
        const teamShortName = dto.teamShortName ?? null;
        const managedTeam = teamShortName
            ? await prisma_1.default.team.findUnique({ where: { shortName: teamShortName } })
            : null;
        const user = await prisma_1.default.user.upsert({
            where: { username },
            update: {},
            create: { username },
        });
        const coachProfile = await prisma_1.default.coachProfile.create({
            data: {
                userId: user.id,
                displayName: managerName,
                avatarId: coachAvatar,
                reputation: 50,
                preferredStyle: "Balanced",
            },
        });
        const payload = {
            season,
            week: 1,
            status: "active",
            currentDate: startDate,
            inboxUnread: 3,
            manager: {
                name: managerName,
                username,
                coachAvatar,
            },
            career: {
                teamShortName,
                unemployed: !teamShortName,
            },
            injuries: [],
            training: {
                rating: 74,
                trend: "steady",
                weekPlan: this.buildDefaultWeekPlan(),
                playerPlans: {},
            },
            trainingPlan: {
                intensity: "balanced",
                focus: "balanced",
            },
            tactics: {
                pace: "balanced",
                threePtFocus: 50,
                defenseScheme: "switch",
                board: {
                    PG: { playerId: null, x: 0.25, y: 0.7 },
                    SG: { playerId: null, x: 0.4, y: 0.75 },
                    SF: { playerId: null, x: 0.6, y: 0.72 },
                    PF: { playerId: null, x: 0.55, y: 0.55 },
                    C: { playerId: null, x: 0.5, y: 0.35 },
                },
            },
            playerState: await this.buildInitialPlayerState(),
            teamState: await this.buildInitialTeamState(),
            rotation: await this.buildInitialRotation(managedTeam?.id ?? null),
            transferState: {
                playerTeamOverrides: {},
                transactions: [],
            },
        };
        const save = await prisma_1.default.save.create({
            data: {
                name: dto.name,
                description: dto.description,
                userId: user.id,
                coachProfileId: coachProfile.id,
                teamId: managedTeam?.id ?? null,
                managedTeamId: managedTeam?.id ?? null,
                coachName: managerName,
                coachAvatarId: coachAvatar,
                season,
                currentDate: new Date(`${startDate}T00:00:00.000Z`),
                version: 1,
                data: payload,
            },
        });
        await this.createInitialInboxMessages(save.id, startDate);
        await this.generateScheduleForSave(save.id, season, seasonStartYear);
        return save;
    }
    async getSaveById(id) {
        const save = await prisma_1.default.save.findUnique({
            where: { id },
            include: {
                coachProfile: true,
                team: true,
            },
        });
        if (!save) {
            throw new AppError_1.NotFoundError("Save");
        }
        return save;
    }
    async getAllSaves() {
        return prisma_1.default.save.findMany({
            include: {
                coachProfile: {
                    select: {
                        displayName: true,
                        avatarId: true,
                    },
                },
                team: {
                    select: {
                        shortName: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async getSaveCoreState(id) {
        const save = await this.getSaveById(id);
        const payload = (save.data ?? {});
        const unread = await prisma_1.default.inboxMessage.count({
            where: { saveId: id, isRead: false },
        });
        let nextMatch = null;
        let lastResult = null;
        if (save.teamId) {
            nextMatch = await prisma_1.default.game.findFirst({
                where: {
                    saveId: save.id,
                    status: "scheduled",
                    OR: [{ homeTeamId: save.teamId }, { awayTeamId: save.teamId }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "asc" },
            });
            lastResult = await prisma_1.default.game.findFirst({
                where: {
                    saveId: save.id,
                    status: "final",
                    OR: [{ homeTeamId: save.teamId }, { awayTeamId: save.teamId }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "desc" },
            });
        }
        return {
            id: save.id,
            name: save.name,
            description: save.description,
            season: save.season,
            currentDate: save.currentDate,
            version: save.version,
            teamId: save.teamId,
            managedTeamId: save.managedTeamId,
            coachName: save.coachName,
            coachAvatarId: save.coachAvatarId,
            team: save.team,
            coachProfile: save.coachProfile,
            inboxCount: unread,
            nextMatch,
            lastResult,
            data: {
                ...payload,
                inboxUnread: unread,
            },
            createdAt: save.createdAt,
            updatedAt: save.updatedAt,
        };
    }
    async advanceSave(id) {
        const save = await this.getSaveById(id);
        const currentData = (save.data ?? {});
        const currentDate = new Date(currentData.currentDate ?? save.currentDate.toISOString().slice(0, 10));
        const dateStart = new Date(`${currentDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
        const dateEnd = new Date(`${currentDate.toISOString().slice(0, 10)}T23:59:59.999Z`);
        const todaysGames = await prisma_1.default.game.findMany({
            where: {
                saveId: save.id,
                status: "scheduled",
                gameDate: { gte: dateStart, lte: dateEnd },
            },
            include: {
                homeTeam: { include: { players: true } },
                awayTeam: { include: { players: true } },
            },
        });
        currentData.playerState = currentData.playerState ?? {};
        currentData.teamState = currentData.teamState ?? {};
        const activePlayers = await prisma_1.default.player.findMany({
            where: { active: true },
            select: {
                id: true,
                position: true,
                overall: true,
                overallBase: true,
                overallCurrent: true,
                potential: true,
                age: true,
                birthDate: true,
                form: true,
                morale: true,
                fatigue: true,
                formTrendDays: true,
                lastFormSnapshot: true,
            },
        });
        const playerMetaById = new Map(activePlayers.map((p) => [p.id, p]));
        const playerPlans = await prisma_1.default.playerTrainingPlan.findMany({
            where: { saveId: save.id },
            select: { playerId: true, focus: true, intensity: true },
        });
        const playerPlanByPlayerId = new Map(playerPlans.map((p) => [p.playerId, p]));
        const playedToday = new Set();
        const playerTeamOverrides = currentData.transferState?.playerTeamOverrides ?? {};
        const movedPlayerIds = Object.keys(playerTeamOverrides).map(Number).filter(Number.isFinite);
        const movedPlayers = movedPlayerIds.length > 0
            ? await prisma_1.default.player.findMany({
                where: { id: { in: movedPlayerIds } },
                select: { id: true, position: true, overall: true, overallCurrent: true, teamId: true },
            })
            : [];
        const movedPlayerById = new Map(movedPlayers.map((p) => [p.id, p]));
        for (const game of todaysGames) {
            const effectiveHomePlayersRaw = this.getEffectiveGameRosterForTeam({
                teamId: game.homeTeamId,
                basePlayers: game.homeTeam.players,
                playerTeamOverrides,
                movedPlayerById,
            });
            const effectiveAwayPlayersRaw = this.getEffectiveGameRosterForTeam({
                teamId: game.awayTeamId,
                basePlayers: game.awayTeam.players,
                playerTeamOverrides,
                movedPlayerById,
            });
            const homePlayers = effectiveHomePlayersRaw
                .sort((a, b) => ((b.overallCurrent ?? b.overall) ?? 60) - ((a.overallCurrent ?? a.overall) ?? 60))
                .slice(0, 10)
                .map((player) => this.toSimPlayer(player, currentData.playerState ?? {}));
            const awayPlayers = effectiveAwayPlayersRaw
                .sort((a, b) => ((b.overallCurrent ?? b.overall) ?? 60) - ((a.overallCurrent ?? a.overall) ?? 60))
                .slice(0, 10)
                .map((player) => this.toSimPlayer(player, currentData.playerState ?? {}));
            const homeTeamState = this.getOrCreateTeamState(currentData, game.homeTeamId);
            const awayTeamState = this.getOrCreateTeamState(currentData, game.awayTeamId);
            const homeRating = (0, simulateGame_1.getTeamRating)(homePlayers, homeTeamState.form);
            const awayRating = (0, simulateGame_1.getTeamRating)(awayPlayers, awayTeamState.form);
            const homeTactics = game.homeTeamId === save.teamId
                ? currentData.tactics
                : { pace: "balanced", threePtFocus: 50, defenseScheme: "switch" };
            const awayTactics = game.awayTeamId === save.teamId
                ? currentData.tactics
                : { pace: "balanced", threePtFocus: 50, defenseScheme: "switch" };
            const result = (0, simulateGame_1.simulateGame)(homePlayers, awayPlayers, homeRating, awayRating, {
                homeTactics,
                awayTactics,
                homeTeamForm: homeTeamState.form,
                awayTeamForm: awayTeamState.form,
            });
            await prisma_1.default.game.update({
                where: { id: game.id },
                data: {
                    status: "final",
                    homeScore: result.homeScore,
                    awayScore: result.awayScore,
                },
            });
            await prisma_1.default.gameStat.createMany({
                data: [
                    ...result.homeStats.map((stat) => ({
                        gameId: game.id,
                        teamId: game.homeTeamId,
                        playerId: stat.playerId,
                        minutes: stat.minutes,
                        points: stat.points,
                        twoPtMade: stat.twoPtMade,
                        twoPtAtt: stat.twoPtAtt,
                        threePtMade: stat.threePtMade,
                        threePtAtt: stat.threePtAtt,
                        ftMade: stat.ftMade,
                        ftAtt: stat.ftAtt,
                        dunks: stat.dunks,
                        oreb: stat.oreb,
                        dreb: stat.dreb,
                        rebounds: stat.rebounds,
                        assists: stat.assists,
                        steals: stat.stl,
                        blocks: stat.blk,
                        turnovers: stat.turnovers,
                        fouls: stat.fouls,
                        plusMinus: stat.plusMinus,
                        performanceRating: stat.performanceRating,
                    })),
                    ...result.awayStats.map((stat) => ({
                        gameId: game.id,
                        teamId: game.awayTeamId,
                        playerId: stat.playerId,
                        minutes: stat.minutes,
                        points: stat.points,
                        twoPtMade: stat.twoPtMade,
                        twoPtAtt: stat.twoPtAtt,
                        threePtMade: stat.threePtMade,
                        threePtAtt: stat.threePtAtt,
                        ftMade: stat.ftMade,
                        ftAtt: stat.ftAtt,
                        dunks: stat.dunks,
                        oreb: stat.oreb,
                        dreb: stat.dreb,
                        rebounds: stat.rebounds,
                        assists: stat.assists,
                        steals: stat.stl,
                        blocks: stat.blk,
                        turnovers: stat.turnovers,
                        fouls: stat.fouls,
                        plusMinus: stat.plusMinus,
                        performanceRating: stat.performanceRating,
                    })),
                ],
            });
            for (const stat of [...result.homeStats, ...result.awayStats]) {
                const key = String(stat.playerId);
                playedToday.add(stat.playerId);
                const prev = currentData.playerState[key] ?? { fatigue: 10, morale: 65, form: 60, formHistory: [], gamesSinceDrift: 0, gamesPlayed: 0 };
                const teamPace = game.homeTeamId === save.teamId
                    ? currentData.tactics?.pace
                    : game.awayTeamId === save.teamId
                        ? currentData.tactics?.pace
                        : "balanced";
                const personalPlan = playerPlanByPlayerId.get(stat.playerId);
                const personalIntensity = this.fromStoredIntensity(personalPlan?.intensity) ?? null;
                const personalFocus = this.fromStoredFocus(personalPlan?.focus) ?? null;
                let fatigueBump = teamPace === "fast" ? 4 : teamPace === "slow" ? 1 : 2;
                if (personalIntensity === "high")
                    fatigueBump += 1;
                if (personalIntensity === "low")
                    fatigueBump -= 1;
                if (personalFocus === "fitness")
                    fatigueBump -= 1;
                fatigueBump = this.clamp(fatigueBump, 0, 6);
                const player = effectiveHomePlayersRaw.find((p) => p.id === stat.playerId)
                    ?? effectiveAwayPlayersRaw.find((p) => p.id === stat.playerId)
                    ?? null;
                const isHomePlayer = effectiveHomePlayersRaw.some((p) => p.id === stat.playerId);
                const playerTeamState = isHomePlayer ? homeTeamState : awayTeamState;
                const didWin = isHomePlayer ? result.homeScore > result.awayScore : result.awayScore > result.homeScore;
                const perfScore = this.computePlayerPerformanceScore({
                    ...stat,
                    position: player?.position ?? "SF",
                });
                const teamFormSupport = (playerTeamState.form - 50) * 0.08;
                const streakSupport = this.clamp(playerTeamState.streak ?? 0, -5, 5) * 0.6;
                const resultBonus = didWin ? 2.5 : -0.6;
                const moraleSupport = ((prev.morale ?? 65) - 50) * 0.04;
                const fatigueDrag = Math.max(0, (prev.fatigue ?? 10) - 60) * 0.05;
                const trainingSupport = personalFocus === "fitness" ? 1.0 : personalFocus ? 0.5 : 0;
                const targetForm = this.clamp(Math.round(perfScore + teamFormSupport + streakSupport + resultBonus + moraleSupport + trainingSupport - fatigueDrag), 35, 95);
                // More inertia than before so form does not collapse to ~50 after a few average games.
                const nextForm = this.clamp(Math.round(prev.form * 0.90 + targetForm * 0.10), 0, 100);
                const formHistory = [...(prev.formHistory ?? []), nextForm].slice(-30);
                currentData.playerState[key] = {
                    fatigue: Math.min(100, prev.fatigue + fatigueBump),
                    morale: Math.max(0, Math.min(100, prev.morale + (didWin ? 1 : 0) + (perfScore >= 65 ? 1 : perfScore <= 40 ? -1 : 0))),
                    form: nextForm,
                    formHistory,
                    gamesSinceDrift: (prev.gamesSinceDrift ?? 0) + 1,
                    gamesPlayed: (prev.gamesPlayed ?? 0) + 1,
                    effectiveOverall: prev.effectiveOverall ?? player?.overallCurrent ?? player?.overall ?? 60,
                };
            }
            this.updateTeamStateAfterGame(currentData, game.homeTeamId, game.awayTeamId, result.homeScore, result.awayScore);
        }
        this.applyDailyTeamFormDecay(currentData, todaysGames);
        const previousWeek = currentData.week ?? 1;
        const nextDate = (0, advanceDay_1.advanceDateByOneDay)(currentDate);
        currentData.currentDate = nextDate.toISOString().slice(0, 10);
        currentData.week = Math.floor((nextDate.getTime() - new Date(`${save.season.slice(0, 4)}-10-01`).getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
        if ((currentData.week ?? 1) < 1)
            currentData.week = 1;
        const rolledWeek = (currentData.week ?? 1) > previousWeek;
        const trainingRating = Math.max(60, Math.min(95, (currentData.training?.rating ?? 74) + (Math.random() > 0.5 ? 1 : -1)));
        currentData.training = {
            rating: trainingRating,
            trend: trainingRating >= 75 ? "up" : "steady",
        };
        this.applyDailyTrainingEffects(currentData, nextDate, rolledWeek, playerPlanByPlayerId);
        await this.applyFormTrendAndSyncPlayers({
            data: currentData,
            playerMetaById,
            playedToday,
        });
        const nextSeasonDay = this.getSeasonDay(save.season, nextDate);
        await this.tradesService.resolvePendingOffersForDay(save.id, nextSeasonDay, nextDate);
        await this.tradesService.resolvePendingPlayerProposalResponsesForDay(save.id, nextSeasonDay, nextDate);
        // Transfer execution may update Save.data.transferState inside TradesService.
        // Refresh and merge it here so the final save update below does not overwrite it with stale currentData.
        {
            const refreshed = await prisma_1.default.save.findUnique({
                where: { id: save.id },
                select: { data: true },
            });
            const refreshedPayload = (refreshed?.data ?? {});
            if (refreshedPayload.transferState) {
                currentData.transferState = refreshedPayload.transferState;
            }
        }
        await this.generateDailyInbox(save.id, nextDate, todaysGames.length);
        const unread = await prisma_1.default.inboxMessage.count({
            where: { saveId: save.id, isRead: false },
        });
        currentData.inboxUnread = unread;
        return prisma_1.default.save.update({
            where: { id },
            data: {
                currentDate: nextDate,
                data: currentData,
                updatedAt: new Date(),
            },
            include: {
                coachProfile: true,
                team: true,
            },
        });
    }
    getSeasonDay(season, date) {
        const startYear = Number(String(season ?? "2025-26").slice(0, 4)) || date.getUTCFullYear();
        const seasonStart = new Date(Date.UTC(startYear, 9, 1));
        return Math.max(0, Math.floor((date.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)));
    }
    async advanceSaveToDate(id, targetDate) {
        const parsed = new Date(`${targetDate}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
            throw new AppError_1.BadRequestError("Invalid targetDate");
        }
        let current = await this.getSaveById(id);
        let iterations = 0;
        while (iterations < 366) {
            const currentData = (current.data ?? {});
            const currentIso = String(currentData.currentDate ?? current.currentDate.toISOString().slice(0, 10));
            const currentDate = new Date(`${currentIso}T00:00:00.000Z`);
            if (currentDate >= parsed)
                break;
            current = await this.advanceSave(id);
            iterations += 1;
        }
        return current;
    }
    async deleteSave(id) {
        await this.getSaveById(id);
        return prisma_1.default.save.delete({
            where: { id },
        });
    }
    async getInbox(id, take = 30, skip = 0) {
        await this.getSaveById(id);
        const normalizedTake = Math.max(1, Math.min(200, Number.isFinite(take) ? Number(take) : 30));
        const normalizedSkip = Math.max(0, Number.isFinite(skip) ? Number(skip) : 0);
        const [messages, unread, total] = await Promise.all([
            prisma_1.default.inboxMessage.findMany({
                where: { saveId: id },
                orderBy: { date: "desc" },
                take: normalizedTake,
                skip: normalizedSkip,
            }),
            prisma_1.default.inboxMessage.count({
                where: { saveId: id, isRead: false },
            }),
            prisma_1.default.inboxMessage.count({
                where: { saveId: id },
            }),
        ]);
        return {
            total,
            unread,
            take: normalizedTake,
            skip: normalizedSkip,
            messages: messages.map((m) => ({
                id: String(m.id),
                subject: m.title,
                body: m.body,
                from: m.fromName,
                createdAt: m.date.toISOString().slice(0, 10),
                type: m.type,
                read: m.isRead,
            })),
        };
    }
    async getSchedule(id, from, to) {
        const save = await this.getSaveById(id);
        const dateFilter = {};
        if (from) {
            dateFilter.gte = new Date(`${from}T00:00:00.000Z`);
        }
        if (to) {
            dateFilter.lte = new Date(`${to}T23:59:59.999Z`);
        }
        return prisma_1.default.game.findMany({
            where: {
                saveId: save.id,
                ...(save.teamId ? { OR: [{ homeTeamId: save.teamId }, { awayTeamId: save.teamId }] } : {}),
                ...(from || to ? { gameDate: dateFilter } : {}),
            },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
            orderBy: { gameDate: "asc" },
        });
    }
    async getResults(id) {
        const save = await this.getSaveById(id);
        const games = await prisma_1.default.game.findMany({
            where: {
                saveId: save.id,
                status: "final",
                ...(save.teamId ? { OR: [{ homeTeamId: save.teamId }, { awayTeamId: save.teamId }] } : {}),
            },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
            orderBy: { gameDate: "desc" },
            take: 100,
        });
        return games.map((game) => ({
            id: game.id,
            gameDate: game.gameDate,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            status: game.status,
        }));
    }
    async getResultDetails(id, gameId) {
        const save = await this.getSaveById(id);
        const game = await prisma_1.default.game.findFirst({
            where: {
                id: gameId,
                saveId: save.id,
                status: "final",
            },
            include: {
                homeTeam: true,
                awayTeam: true,
                gameStats: {
                    include: {
                        player: {
                            include: { team: true },
                        },
                    },
                    orderBy: { points: "desc" },
                },
            },
        });
        if (!game) {
            throw new AppError_1.NotFoundError("Game");
        }
        // Backward-compatibility: older simulated games may have player points that do not sum
        // exactly to the final team score. Normalize on read so boxscore points match the result.
        const homeBoxRows = game.gameStats.filter((s) => (s.teamId ?? s.player.teamId) === game.homeTeamId);
        const awayBoxRows = game.gameStats.filter((s) => (s.teamId ?? s.player.teamId) === game.awayTeamId);
        this.normalizeGameStatPointsForDisplay(homeBoxRows, game.homeScore);
        this.normalizeGameStatPointsForDisplay(awayBoxRows, game.awayScore);
        const playerOfTheMatch = [...game.gameStats].sort((a, b) => (b.performanceRating ?? 0) - (a.performanceRating ?? 0))[0] ?? null;
        const topScorer = [...game.gameStats].sort((a, b) => b.points - a.points)[0] ?? null;
        const teamStats = {
            home: this.aggregateTeamStats(game.gameStats.filter((s) => (s.teamId ?? s.player.teamId) === game.homeTeamId)),
            away: this.aggregateTeamStats(game.gameStats.filter((s) => (s.teamId ?? s.player.teamId) === game.awayTeamId)),
        };
        return {
            id: game.id,
            gameDate: game.gameDate,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            playerOfTheMatch: playerOfTheMatch
                ? {
                    playerId: playerOfTheMatch.playerId,
                    name: playerOfTheMatch.player.name,
                    teamShortName: (playerOfTheMatch.teamId === game.homeTeamId ? game.homeTeam.shortName : playerOfTheMatch.teamId === game.awayTeamId ? game.awayTeam.shortName : (playerOfTheMatch.player.team?.shortName ?? "-")),
                    points: playerOfTheMatch.points,
                    rebounds: playerOfTheMatch.rebounds,
                    assists: playerOfTheMatch.assists,
                    performanceRating: playerOfTheMatch.performanceRating,
                }
                : null,
            topScorer: topScorer
                ? {
                    playerId: topScorer.playerId,
                    name: topScorer.player.name,
                    teamShortName: (topScorer.teamId === game.homeTeamId ? game.homeTeam.shortName : topScorer.teamId === game.awayTeamId ? game.awayTeam.shortName : (topScorer.player.team?.shortName ?? "-")),
                    points: topScorer.points,
                }
                : null,
            basicStats: teamStats,
            players: game.gameStats.map((stat) => ({
                playerId: stat.playerId,
                name: stat.player.name,
                teamShortName: stat.teamId === game.homeTeamId ? game.homeTeam.shortName : stat.teamId === game.awayTeamId ? game.awayTeam.shortName : (stat.player.team?.shortName ?? "-"),
                minutes: stat.minutes,
                points: stat.points,
                twoPtMade: stat.twoPtMade,
                twoPtAtt: stat.twoPtAtt,
                threePtMade: stat.threePtMade,
                threePtAtt: stat.threePtAtt,
                ftMade: stat.ftMade,
                ftAtt: stat.ftAtt,
                dunks: stat.dunks,
                oreb: stat.oreb,
                dreb: stat.dreb,
                rebounds: stat.rebounds,
                assists: stat.assists,
                steals: stat.steals,
                blocks: stat.blocks,
                turnovers: stat.turnovers,
                fouls: stat.fouls,
                plusMinus: stat.plusMinus,
                performanceRating: stat.performanceRating,
            })),
        };
    }
    normalizeGameStatPointsForDisplay(stats, targetPoints) {
        if (!stats.length)
            return;
        let delta = targetPoints - stats.reduce((sum, s) => sum + (s.points ?? 0), 0);
        if (delta === 0)
            return;
        const ordered = [...stats].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
        let guard = 0;
        while (delta !== 0 && guard < 2000) {
            guard += 1;
            for (const row of ordered) {
                if (delta === 0)
                    break;
                if (delta > 0) {
                    row.points = (row.points ?? 0) + 1;
                    delta -= 1;
                    continue;
                }
                if ((row.points ?? 0) <= 0)
                    continue;
                row.points = (row.points ?? 0) - 1;
                delta += 1;
            }
            if (delta < 0 && ordered.every((r) => (r.points ?? 0) <= 0))
                break;
        }
    }
    async getStandings(id) {
        const save = await this.getSaveById(id);
        const { east, west } = await this.buildConferenceStandings(save.id);
        return {
            east,
            west,
        };
    }
    async markInboxMessageRead(saveId, msgId) {
        await this.getSaveById(saveId);
        const message = await prisma_1.default.inboxMessage.findFirst({
            where: { id: msgId, saveId },
        });
        if (!message) {
            throw new AppError_1.NotFoundError("InboxMessage");
        }
        await prisma_1.default.inboxMessage.update({
            where: { id: msgId },
            data: { isRead: true },
        });
        const unread = await prisma_1.default.inboxMessage.count({
            where: { saveId, isRead: false },
        });
        const save = await prisma_1.default.save.findUnique({ where: { id: saveId } });
        const data = (save?.data ?? {});
        data.inboxUnread = unread;
        if (save) {
            await prisma_1.default.save.update({
                where: { id: saveId },
                data: { data },
            });
        }
        return {
            success: true,
            unread,
            messageId: msgId,
        };
    }
    async deleteInboxMessage(saveId, msgId) {
        await this.getSaveById(saveId);
        const message = await prisma_1.default.inboxMessage.findFirst({
            where: { id: msgId, saveId },
        });
        if (!message) {
            throw new AppError_1.NotFoundError("InboxMessage");
        }
        await prisma_1.default.inboxMessage.delete({
            where: { id: msgId },
        });
        const unread = await prisma_1.default.inboxMessage.count({
            where: { saveId, isRead: false },
        });
        const save = await prisma_1.default.save.findUnique({ where: { id: saveId } });
        const data = (save?.data ?? {});
        data.inboxUnread = unread;
        if (save) {
            await prisma_1.default.save.update({
                where: { id: saveId },
                data: { data },
            });
        }
        return {
            success: true,
            unread,
            deletedMessageId: msgId,
        };
    }
    async saveRotation(saveId, rotation) {
        const save = await this.getSaveById(saveId);
        const data = (save.data ?? {});
        data.rotation = rotation ?? {};
        const updated = await prisma_1.default.save.update({
            where: { id: saveId },
            data: { data },
        });
        return {
            success: true,
            rotation: updated.data.rotation ?? {},
        };
    }
    async saveTactics(saveId, tactics) {
        const save = await this.getSaveById(saveId);
        const data = (save.data ?? {});
        const nextTactics = {
            pace: "balanced",
            threePtFocus: 50,
            defenseScheme: "switch",
            ...(data.tactics ?? {}),
            ...(tactics ?? {}),
        };
        nextTactics.threePtFocus = Math.max(0, Math.min(100, Number(nextTactics.threePtFocus ?? 50)));
        if (nextTactics.board) {
            const sanitizedBoard = Object.fromEntries(Object.entries(nextTactics.board).map(([slot, value]) => {
                const v = value ?? { playerId: null, x: 0.5, y: 0.5 };
                return [slot, {
                        playerId: typeof v.playerId === "number" ? v.playerId : null,
                        x: Math.max(0, Math.min(1, Number(v.x ?? 0.5))),
                        y: Math.max(0, Math.min(1, Number(v.y ?? 0.5))),
                    }];
            }));
            nextTactics.board = sanitizedBoard;
        }
        data.tactics = nextTactics;
        const updated = await prisma_1.default.save.update({
            where: { id: saveId },
            data: { data },
        });
        return {
            success: true,
            tactics: updated.data.tactics ?? nextTactics,
        };
    }
    async saveTrainingPlan(saveId, payload) {
        const save = await this.getSaveById(saveId);
        const data = (save.data ?? {});
        const trainingPlan = payload.trainingPlan ?? {};
        data.trainingPlan = {
            intensity: "balanced",
            focus: "balanced",
            ...(data.trainingPlan ?? {}),
            ...trainingPlan,
        };
        data.training = {
            rating: data.training?.rating ?? 74,
            trend: data.training?.trend ?? "steady",
            weekPlan: {
                ...this.buildDefaultWeekPlan(),
                ...(data.training?.weekPlan ?? {}),
                ...(payload.weekPlan ?? {}),
            },
            playerPlans: {
                ...(data.training?.playerPlans ?? {}),
                ...(payload.playerPlans ?? {}),
            },
            teamProfiles: payload.teamProfiles ?? data.training?.teamProfiles ?? [],
            activeTeamProfileId: payload.activeTeamProfileId ?? data.training?.activeTeamProfileId,
        };
        const updated = await prisma_1.default.save.update({
            where: { id: saveId },
            data: { data },
        });
        return {
            success: true,
            trainingPlan: updated.data.trainingPlan ?? data.trainingPlan,
            training: updated.data.training ?? data.training,
        };
    }
    async getTrainingConfig(saveId) {
        const save = await this.getSaveById(saveId);
        const data = (save.data ?? {});
        return {
            success: true,
            trainingPlan: data.trainingPlan ?? { intensity: "balanced", focus: "balanced" },
            training: {
                rating: data.training?.rating ?? 74,
                trend: data.training?.trend ?? "steady",
                teamProfiles: data.training?.teamProfiles ?? [],
                activeTeamProfileId: data.training?.activeTeamProfileId ?? null,
                weekPlan: {
                    ...this.buildDefaultWeekPlan(),
                    ...(data.training?.weekPlan ?? {}),
                },
            },
            currentDate: data.currentDate ?? save.currentDate.toISOString().slice(0, 10),
            saveId: save.id,
        };
    }
    async getPlayerTrainingPlans(saveId) {
        const save = await this.getSaveById(saveId);
        const data = (save.data ?? {});
        const playerState = data.playerState ?? {};
        const plans = await prisma_1.default.playerTrainingPlan.findMany({
            where: { saveId },
            include: {
                player: {
                    select: {
                        id: true,
                        name: true,
                        position: true,
                        overallBase: true,
                        overallCurrent: true,
                        form: true,
                        fatigue: true,
                        team: {
                            select: {
                                id: true,
                                shortName: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ updatedAt: "desc" }],
        });
        return plans.map((plan) => {
            const state = playerState[String(plan.playerId)] ?? {};
            return {
                id: plan.id,
                saveId: plan.saveId,
                playerId: plan.playerId,
                focus: plan.focus,
                intensity: plan.intensity,
                createdAt: plan.createdAt,
                updatedAt: plan.updatedAt,
                player: {
                    id: plan.player.id,
                    name: plan.player.name,
                    team: plan.player.team,
                    pos: plan.player.position,
                    overallBase: plan.player.overallBase,
                    overallCurrent: state.effectiveOverall ?? plan.player.overallCurrent ?? plan.player.overallBase,
                    form: state.form ?? plan.player.form,
                    fatigue: state.fatigue ?? plan.player.fatigue,
                },
            };
        });
    }
    async upsertPlayerTrainingPlan(saveId, payload) {
        if (!Number.isFinite(payload.playerId)) {
            throw new AppError_1.BadRequestError("playerId is required");
        }
        await this.getSaveById(saveId);
        const player = await prisma_1.default.player.findUnique({
            where: { id: payload.playerId },
            select: { id: true, active: true },
        });
        if (!player)
            throw new AppError_1.NotFoundError("Player");
        const focus = this.normalizeTrainingFocusEnum(payload.focus);
        const intensity = this.normalizeTrainingIntensityEnum(payload.intensity);
        const plan = await prisma_1.default.playerTrainingPlan.upsert({
            where: {
                saveId_playerId: {
                    saveId,
                    playerId: payload.playerId,
                },
            },
            create: {
                saveId,
                playerId: payload.playerId,
                focus,
                intensity,
            },
            update: {
                focus,
                intensity,
            },
        });
        return { success: true, plan };
    }
    async deletePlayerTrainingPlan(saveId, playerId) {
        await this.getSaveById(saveId);
        await prisma_1.default.playerTrainingPlan.deleteMany({
            where: { saveId, playerId },
        });
        return { success: true };
    }
    async getNextMatchScouting(saveId) {
        const save = await this.getSaveById(saveId);
        if (!save.teamId) {
            return null;
        }
        const nextMatch = await prisma_1.default.game.findFirst({
            where: {
                saveId: save.id,
                status: "scheduled",
                OR: [{ homeTeamId: save.teamId }, { awayTeamId: save.teamId }],
            },
            include: {
                homeTeam: { include: { players: true } },
                awayTeam: { include: { players: true } },
            },
            orderBy: { gameDate: "asc" },
        });
        if (!nextMatch) {
            return null;
        }
        const managedIsHome = nextMatch.homeTeamId === save.teamId;
        const opponentTeam = managedIsHome ? nextMatch.awayTeam : nextMatch.homeTeam;
        const managedTeam = managedIsHome ? nextMatch.homeTeam : nextMatch.awayTeam;
        const venue = managedIsHome ? "Home" : "Away";
        const payload = (save.data ?? {});
        return {
            gameId: nextMatch.id,
            date: nextMatch.gameDate,
            venue,
            opponent: {
                id: opponentTeam.id,
                name: opponentTeam.name,
                shortName: opponentTeam.shortName,
            },
            managedTeam: {
                id: managedTeam.id,
                name: managedTeam.name,
                shortName: managedTeam.shortName,
            },
            probableStarters: {
                managed: this.getManagedProbableStarters(payload, managedTeam.players),
                opponent: this.getDefaultProbableStarters(opponentTeam.players),
            },
            last5: {
                managed: await this.getTeamLastFive(save.id, managedTeam.id),
                opponent: await this.getTeamLastFive(save.id, opponentTeam.id),
            },
        };
    }
    async getDashboardSummary(id) {
        const save = await this.getSaveById(id);
        const payload = (save.data ?? {});
        const team = save.team;
        const nextMatch = team
            ? await prisma_1.default.game.findFirst({
                where: {
                    saveId: save.id,
                    status: "scheduled",
                    OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "asc" },
            })
            : null;
        const recentResults = team
            ? await prisma_1.default.game.findMany({
                where: {
                    saveId: save.id,
                    status: "final",
                    OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "desc" },
                take: 5,
            })
            : [];
        const conferenceStandings = await this.buildConferenceStandings(save.id);
        const standings = [...conferenceStandings.east, ...conferenceStandings.west]
            .sort((a, b) => b.pct - a.pct || b.wins - a.wins)
            .slice(0, 10);
        const scoringLeadersRaw = await prisma_1.default.gameStat.groupBy({
            by: ["playerId"],
            _sum: { points: true },
            orderBy: { _sum: { points: "desc" } },
            take: 5,
        });
        let leaders = [];
        if (scoringLeadersRaw.length > 0) {
            const players = await prisma_1.default.player.findMany({
                where: { id: { in: scoringLeadersRaw.map((r) => r.playerId) } },
                select: { id: true, name: true },
            });
            const playerMap = new Map(players.map((p) => [p.id, p.name]));
            leaders = scoringLeadersRaw.map((row) => ({
                name: playerMap.get(row.playerId) ?? "Unknown",
                value: row._sum.points ?? 0,
                metric: "PTS",
            }));
        }
        else {
            const fallback = await prisma_1.default.player.findMany({
                orderBy: { salary: "desc" },
                take: 5,
                select: { name: true, salary: true },
            });
            leaders = fallback.map((player) => ({
                name: player.name,
                value: Math.round((player.salary ?? 0) / 1000000),
                metric: "Salary(M)",
            }));
        }
        const latestInbox = await prisma_1.default.inboxMessage.findMany({
            where: { saveId: id },
            orderBy: { date: "desc" },
            take: 3,
        });
        const unread = await prisma_1.default.inboxMessage.count({
            where: { saveId: id, isRead: false },
        });
        return {
            nextMatch,
            recentResults,
            standings,
            leaders,
            inbox: {
                unread,
                latest: latestInbox.map((m) => ({
                    id: String(m.id),
                    subject: m.title,
                    body: m.body,
                    from: m.fromName,
                    createdAt: m.date.toISOString().slice(0, 10),
                    read: m.isRead,
                })),
            },
            injuries: payload.injuries ?? [],
            training: payload.training ?? { rating: 74, trend: "steady" },
            teamState: payload.teamState ?? {},
        };
    }
    async buildConferenceStandings(saveId) {
        const [teams, games] = await Promise.all([
            prisma_1.default.team.findMany({
                select: {
                    id: true,
                    name: true,
                    shortName: true,
                    conference: true,
                    division: true,
                },
            }),
            prisma_1.default.game.findMany({
                where: { saveId, status: "final" },
                select: {
                    id: true,
                    gameDate: true,
                    homeTeamId: true,
                    awayTeamId: true,
                    homeScore: true,
                    awayScore: true,
                },
                orderBy: { gameDate: "asc" },
            }),
        ]);
        const rows = new Map();
        const teamGames = new Map();
        for (const team of teams) {
            const conference = this.normalizeConference(team.conference);
            rows.set(team.id, {
                teamId: team.id,
                team: team.name,
                shortName: team.shortName,
                conference,
                division: team.division ?? "Unknown",
                wins: 0,
                losses: 0,
                pct: 0,
                gb: 0,
                streak: "-",
            });
            teamGames.set(team.id, []);
        }
        for (const game of games) {
            const home = rows.get(game.homeTeamId);
            const away = rows.get(game.awayTeamId);
            if (!home || !away)
                continue;
            const homeWin = game.homeScore >= game.awayScore;
            if (homeWin) {
                home.wins += 1;
                away.losses += 1;
            }
            else {
                away.wins += 1;
                home.losses += 1;
            }
            teamGames.get(game.homeTeamId)?.push({ result: homeWin ? "W" : "L", date: game.gameDate });
            teamGames.get(game.awayTeamId)?.push({ result: homeWin ? "L" : "W", date: game.gameDate });
        }
        for (const row of rows.values()) {
            const played = row.wins + row.losses;
            row.pct = played > 0 ? Number((row.wins / played).toFixed(3)) : 0;
            row.streak = this.computeStreak(teamGames.get(row.teamId) ?? []);
        }
        const all = [...rows.values()];
        const east = this.withGamesBack(all.filter((r) => r.conference === "East"));
        const west = this.withGamesBack(all.filter((r) => r.conference === "West"));
        return { east, west };
    }
    withGamesBack(rows) {
        const sorted = [...rows].sort((a, b) => b.pct - a.pct || b.wins - a.wins || a.losses - b.losses || a.team.localeCompare(b.team));
        const leader = sorted[0];
        if (!leader)
            return [];
        return sorted.map((row) => ({
            ...row,
            gb: Number((((leader.wins - row.wins) + (row.losses - leader.losses)) / 2).toFixed(1)),
        }));
    }
    normalizeConference(conf) {
        const value = (conf ?? "").toLowerCase();
        if (value.includes("east"))
            return "East";
        if (value.includes("west"))
            return "West";
        return "West";
    }
    computeStreak(results) {
        if (results.length === 0)
            return "-";
        const sorted = [...results].sort((a, b) => b.date.getTime() - a.date.getTime());
        const last = sorted[0].result;
        let count = 0;
        for (const item of sorted) {
            if (item.result !== last)
                break;
            count += 1;
        }
        return `${last}${count}`;
    }
    getDefaultProbableStarters(players) {
        const sorted = [...players].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
        const pick = (token) => sorted.find((p) => (p.position ?? "").includes(token));
        const starters = [pick("PG"), pick("SG"), pick("SF"), pick("PF"), pick("C")].filter(Boolean);
        const fallback = sorted.slice(0, 5);
        const final = starters.length === 5 ? starters : fallback;
        return final.map((p) => ({ id: p.id, name: p.name, position: p.position }));
    }
    getManagedProbableStarters(payload, players) {
        const byId = new Map(players.map((p) => [p.id, p]));
        const rotationIds = ["PG", "SG", "SF", "PF", "C"]
            .map((pos) => payload.rotation?.[pos])
            .filter((id) => typeof id === "number");
        const fromRotation = rotationIds
            .map((id) => byId.get(id))
            .filter((p) => Boolean(p));
        if (fromRotation.length >= 5) {
            return fromRotation.slice(0, 5).map((p) => ({ id: p.id, name: p.name, position: p.position }));
        }
        return this.getDefaultProbableStarters(players);
    }
    async getTeamLastFive(saveId, teamId) {
        const recent = await prisma_1.default.game.findMany({
            where: {
                saveId,
                status: "final",
                OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            },
            orderBy: { gameDate: "desc" },
            take: 5,
            select: {
                homeTeamId: true,
                awayTeamId: true,
                homeScore: true,
                awayScore: true,
            },
        });
        return recent.map((g) => {
            const isHome = g.homeTeamId === teamId;
            const won = isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
            return won ? "W" : "L";
        });
    }
    applyDailyTrainingEffects(data, date, rolledWeek, persistedPlans) {
        data.playerState = data.playerState ?? {};
        data.training = data.training ?? { rating: 74, trend: "steady", weekPlan: this.buildDefaultWeekPlan(), playerPlans: {} };
        data.training.weekPlan = {
            ...this.buildDefaultWeekPlan(),
            ...(data.training.weekPlan ?? {}),
        };
        data.training.playerPlans = data.training.playerPlans ?? {};
        const dayKey = this.getDayKey(date);
        const dayPlan = data.training.weekPlan[dayKey] ?? { intensity: "balanced", focus: "balanced" };
        let appliedPlanCount = 0;
        for (const key of Object.keys(data.playerState)) {
            const prev = data.playerState[key];
            const persisted = persistedPlans?.get(Number(key));
            const personal = data.training.playerPlans[key];
            const intensity = this.fromStoredIntensity(persisted?.intensity) ?? personal?.intensity ?? dayPlan.intensity;
            const focus = this.fromStoredFocus(persisted?.focus) ?? personal?.focus ?? dayPlan.focus;
            if (persisted)
                appliedPlanCount += 1;
            const injuryPenalty = this.isPlayerInjured(data, key) ? 0.4 : 1;
            const fatigueDelta = intensity === "high" ? 1 : intensity === "low" ? -3 : -1;
            const recoveryBonus = rolledWeek ? (intensity === "low" ? 5 : 3) : (intensity === "low" ? 1 : 0);
            const intensityFormBonus = intensity === "high" ? 0.45 : intensity === "low" ? 0.2 : 0.3;
            const focusBonus = focus === "fitness"
                ? 1.2
                : focus === "balanced"
                    ? 0.7
                    : focus === "playmaking"
                        ? 0.95
                        : 0.9;
            const moraleContextBonus = (prev.morale >= 65 ? 0.25 : prev.morale <= 40 ? -0.2 : 0);
            const fatigueContextPenalty = prev.fatigue >= 75 ? 0.35 : 0;
            const formDeltaBase = focusBonus + intensityFormBonus;
            const formDelta = (formDeltaBase + moraleContextBonus - fatigueContextPenalty) * injuryPenalty;
            data.playerState[key] = {
                ...prev,
                fatigue: this.clamp(Math.round(prev.fatigue + fatigueDelta - recoveryBonus), 0, 100),
                form: this.clamp(Math.round(prev.form + formDelta), 0, 100),
                morale: this.clamp(Math.round(prev.morale + (formDelta > 0.7 ? 0.7 : formDelta > 0 ? 0.3 : -0.2)), 0, 100),
            };
        }
        console.log(`[training] applied daily plans: ${appliedPlanCount}`);
    }
    isPlayerInjured(data, playerId) {
        const injuredNames = new Set((data.injuries ?? []).map((injury) => injury.playerName.toLowerCase().trim()));
        if (injuredNames.size === 0)
            return false;
        return false;
    }
    getDayKey(date) {
        const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return map[date.getUTCDay()] ?? "Mon";
    }
    buildDefaultWeekPlan() {
        return {
            Mon: { intensity: "balanced", focus: "fitness" },
            Tue: { intensity: "high", focus: "shooting" },
            Wed: { intensity: "balanced", focus: "defense" },
            Thu: { intensity: "low", focus: "fitness" },
            Fri: { intensity: "high", focus: "balanced" },
            Sat: { intensity: "balanced", focus: "shooting" },
            Sun: { intensity: "low", focus: "fitness" },
        };
    }
    normalizeTrainingFocusEnum(raw) {
        const v = String(raw ?? "").trim().toUpperCase();
        if (v === "SHOOTING" || v === "PLAYMAKING" || v === "DEFENSE" || v === "CONDITIONING")
            return v;
        return "BALANCED";
    }
    normalizeTrainingIntensityEnum(raw) {
        const v = String(raw ?? "").trim().toUpperCase();
        if (v === "LOW" || v === "HIGH")
            return v;
        return "BALANCED";
    }
    fromStoredFocus(raw) {
        const v = String(raw ?? "").trim().toUpperCase();
        if (v === "SHOOTING")
            return "shooting";
        if (v === "PLAYMAKING")
            return "playmaking";
        if (v === "DEFENSE")
            return "defense";
        if (v === "CONDITIONING")
            return "fitness";
        if (v === "BALANCED")
            return "balanced";
        return null;
    }
    fromStoredIntensity(raw) {
        const v = String(raw ?? "").trim().toUpperCase();
        if (v === "LOW")
            return "low";
        if (v === "HIGH")
            return "high";
        if (v === "BALANCED")
            return "balanced";
        return null;
    }
    async applyFormTrendAndSyncPlayers(params) {
        const updates = [];
        for (const [key, state] of Object.entries(params.data.playerState ?? {})) {
            const playerId = Number(key);
            if (!Number.isFinite(playerId))
                continue;
            const player = params.playerMetaById.get(playerId);
            if (!player)
                continue;
            const baseOverall = player.overallBase ?? player.overall ?? 60;
            const prevOverallCurrent = state.effectiveOverall ?? player.overallCurrent ?? baseOverall;
            let overallCurrent = prevOverallCurrent;
            let formTrendDays = player.formTrendDays ?? 0;
            const form = this.clamp(Math.round(state.form ?? player.form ?? 70), 0, 100);
            const morale = this.clamp(Math.round(state.morale ?? player.morale ?? 50), 0, 100);
            const fatigue = this.clamp(Math.round(state.fatigue ?? player.fatigue ?? 10), 0, 100);
            const delta = form - 70;
            const step = params.playedToday.has(playerId) ? 2 : 1;
            if (delta >= 8) {
                formTrendDays += step;
            }
            else if (delta <= -8) {
                formTrendDays -= step;
            }
            else if (formTrendDays > 0) {
                formTrendDays -= 1;
            }
            else if (formTrendDays < 0) {
                formTrendDays += 1;
            }
            const lower = Math.max(40, baseOverall - 8);
            const upper = Math.min(99, baseOverall + 8);
            overallCurrent = this.clamp(Math.round(baseOverall
                + (form - 70) * 0.25
                - (fatigue - 50) * 0.15
                + (morale - 50) * 0.10), lower, upper);
            if (overallCurrent !== prevOverallCurrent) {
                console.log(`[drift] player ${playerId} overallCurrent ${prevOverallCurrent} -> ${overallCurrent}`);
            }
            state.effectiveOverall = overallCurrent;
            state.form = form;
            state.morale = morale;
            state.fatigue = fatigue;
            updates.push(prisma_1.default.player.update({
                where: { id: playerId },
                data: {
                    form,
                    morale,
                    fatigue,
                    overallCurrent,
                    overall: overallCurrent,
                    formTrendDays,
                    lastFormSnapshot: form,
                },
            }));
        }
        if (updates.length > 0) {
            await prisma_1.default.$transaction(updates);
        }
    }
    aggregateTeamStats(stats) {
        const initial = {
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            twoPtMade: 0,
            twoPtAtt: 0,
            threePtMade: 0,
            threePtAtt: 0,
            ftMade: 0,
            ftAtt: 0,
        };
        return stats.reduce((acc, stat) => ({
            points: acc.points + stat.points,
            rebounds: acc.rebounds + stat.rebounds,
            assists: acc.assists + stat.assists,
            steals: acc.steals + (stat.steals ?? 0),
            blocks: acc.blocks + (stat.blocks ?? 0),
            turnovers: acc.turnovers + (stat.turnovers ?? 0),
            twoPtMade: acc.twoPtMade + (stat.twoPtMade ?? 0),
            twoPtAtt: acc.twoPtAtt + (stat.twoPtAtt ?? 0),
            threePtMade: acc.threePtMade + (stat.threePtMade ?? 0),
            threePtAtt: acc.threePtAtt + (stat.threePtAtt ?? 0),
            ftMade: acc.ftMade + (stat.ftMade ?? 0),
            ftAtt: acc.ftAtt + (stat.ftAtt ?? 0),
        }), initial);
    }
    async createInitialInboxMessages(saveId, startDate) {
        const baseDate = new Date(`${startDate}T00:00:00.000Z`);
        await prisma_1.default.inboxMessage.createMany({
            data: [
                {
                    saveId,
                    date: baseDate,
                    type: "board",
                    title: "Welcome to the franchise",
                    body: "Ownership expects a playoff push this season.",
                    fromName: "Board",
                    isRead: false,
                },
                {
                    saveId,
                    date: baseDate,
                    type: "scouting",
                    title: "Scouting report updated",
                    body: "Three perimeter defenders were highlighted this week.",
                    fromName: "Head Scout",
                    isRead: false,
                },
                {
                    saveId,
                    date: baseDate,
                    type: "training",
                    title: "Training focus ready",
                    body: "Player development plan has been prepared by staff.",
                    fromName: "Coaching Staff",
                    isRead: false,
                },
            ],
        });
    }
    async createInboxMessage(params) {
        return prisma_1.default.inboxMessage.create({
            data: {
                saveId: params.saveId,
                date: params.date,
                type: params.type,
                title: params.title,
                body: params.body,
                fromName: params.fromName,
                isRead: false,
            },
        });
    }
    async generateDailyInbox(saveId, date, gamesSimulated) {
        const candidates = [
            {
                type: "media",
                title: "Daily media briefing",
                body: gamesSimulated > 0
                    ? `Around the league: ${gamesSimulated} games finished today.`
                    : "No games today. Media focus shifted to training and rumors.",
                fromName: "League Media",
            },
            {
                type: "training",
                title: "Training report completed",
                body: "Staff submitted an updated form and fatigue report for your squad.",
                fromName: "Performance Staff",
            },
            {
                type: "injury",
                title: "Medical room update",
                body: "No major injuries reported today. Continue monitoring workload.",
                fromName: "Medical Team",
            },
            {
                type: "scouting",
                title: "Scouting note",
                body: "Regional scouts flagged two perimeter shooters worth monitoring.",
                fromName: "Head Scout",
            },
        ];
        const count = 1 + Math.floor(Math.random() * 3);
        const chosen = candidates.sort(() => Math.random() - 0.5).slice(0, count);
        for (const msg of chosen) {
            await this.createInboxMessage({
                saveId,
                date,
                ...msg,
            });
        }
    }
    async generateScheduleForSave(saveId, season, seasonStartYear) {
        const gamesCount = await prisma_1.default.game.count({
            where: { saveId },
        });
        if (gamesCount > 0)
            return;
        const teams = await prisma_1.default.team.findMany({
            orderBy: { id: "asc" },
            select: { id: true, shortName: true },
        });
        if (teams.length < 2)
            return;
        const teamByShortName = new Map(teams.map((t) => [t.shortName, t.id]));
        const realSchedule = this.loadRealScheduleForSeason(season, teamByShortName);
        const schedule = realSchedule.length > 0
            ? realSchedule
            : (0, scheduleGenerator_1.generateSeasonSchedule)(teams.map((t) => t.id), new Date(`${seasonStartYear}-10-01T12:00:00.000Z`));
        if (schedule.length === 0)
            return;
        await prisma_1.default.game.createMany({
            data: schedule.map((game) => ({
                saveId,
                homeTeamId: game.homeTeamId,
                awayTeamId: game.awayTeamId,
                gameDate: game.gameDate,
                status: game.status,
                homeScore: game.homeScore,
                awayScore: game.awayScore,
            })),
        });
    }
    loadRealScheduleForSeason(season, teamByShortName) {
        const dataDir = node_path_1.default.resolve(__dirname, "..", "..", "..", "prisma", "data");
        const scheduleFile = node_path_1.default.join(dataDir, `schedule.nba.${season}.json`);
        if (!node_fs_1.default.existsSync(scheduleFile))
            return [];
        const raw = node_fs_1.default.readFileSync(scheduleFile, "utf8");
        const rows = JSON.parse(raw);
        const output = [];
        for (const row of rows) {
            const homeShort = (row.homeTeamShortName ?? row.homeShortName ?? "").toUpperCase();
            const awayShort = (row.awayTeamShortName ?? row.awayShortName ?? "").toUpperCase();
            const homeTeamId = teamByShortName.get(homeShort);
            const awayTeamId = teamByShortName.get(awayShort);
            const gameDateRaw = row.gameDate ?? row.date;
            if (!homeTeamId || !awayTeamId || !gameDateRaw)
                continue;
            const gameDate = new Date(gameDateRaw);
            if (Number.isNaN(gameDate.getTime()))
                continue;
            output.push({
                homeTeamId,
                awayTeamId,
                gameDate,
                status: row.status ?? "scheduled",
                homeScore: row.homeScore ?? 0,
                awayScore: row.awayScore ?? 0,
            });
        }
        return output;
    }
    async buildInitialPlayerState() {
        const players = await prisma_1.default.player.findMany({
            where: { active: true },
            select: {
                id: true,
                overall: true,
            },
        });
        const out = {};
        for (const player of players) {
            const noise = this.deterministicNoise(player.id, -6, 6);
            const form = this.clamp(Math.round(player.overall + noise), 0, 100);
            out[String(player.id)] = {
                fatigue: 10,
                morale: 65,
                form,
                effectiveOverall: player.overall,
                formHistory: [form],
                gamesSinceDrift: 0,
                gamesPlayed: 0,
            };
        }
        return out;
    }
    async buildInitialTeamState() {
        const teams = await prisma_1.default.team.findMany({
            select: {
                id: true,
                players: {
                    where: { active: true },
                    select: { overall: true },
                },
            },
        });
        const out = {};
        for (const team of teams) {
            const roster = team.players;
            const avgOverall = roster.length > 0
                ? roster.reduce((sum, p) => sum + (p.overall ?? 60), 0) / roster.length
                : 60;
            const baselineForm = this.clamp(Math.round(50 + (avgOverall - 75) * 0.8), 35, 85);
            out[String(team.id)] = {
                form: baselineForm,
                last5: "",
                streak: 0,
                offenseRating: this.clamp(Math.round(avgOverall + 2), 60, 99),
                defenseRating: this.clamp(Math.round(avgOverall), 60, 99),
            };
        }
        return out;
    }
    toSimPlayer(player, playerState) {
        const state = playerState[String(player.id)];
        const form = state?.form ?? 60;
        const matchOverall = this.clamp(Math.round(state?.effectiveOverall ?? player.overallCurrent ?? player.overall ?? 60), 40, 99);
        return {
            playerId: player.id,
            position: player.position ?? "N/A",
            form,
            matchOverall,
        };
    }
    getEffectiveGameRosterForTeam(params) {
        const base = params.basePlayers.filter((p) => {
            const overrideTeamId = params.playerTeamOverrides[String(p.id)];
            return overrideTeamId == null || overrideTeamId === params.teamId;
        });
        const extras = [];
        for (const [playerIdKey, overrideTeamId] of Object.entries(params.playerTeamOverrides)) {
            if (overrideTeamId !== params.teamId)
                continue;
            const playerId = Number(playerIdKey);
            if (base.some((p) => p.id === playerId))
                continue;
            const moved = params.movedPlayerById.get(playerId);
            if (moved)
                extras.push(moved);
        }
        return [...base, ...extras];
    }
    getOrCreateTeamState(data, teamId) {
        data.teamState = data.teamState ?? {};
        const key = String(teamId);
        const existing = data.teamState[key];
        if (existing)
            return existing;
        const created = { form: 50, last5: "", streak: 0, offenseRating: 75, defenseRating: 75 };
        data.teamState[key] = created;
        return created;
    }
    updateTeamStateAfterGame(data, homeTeamId, awayTeamId, homeScore, awayScore) {
        const home = this.getOrCreateTeamState(data, homeTeamId);
        const away = this.getOrCreateTeamState(data, awayTeamId);
        const margin = homeScore - awayScore;
        const homeWin = margin > 0;
        const awayWin = !homeWin;
        const homeFormNext = this.computeTeamFormAfterGame({
            teamForm: home.form,
            teamStrength: this.estimateTeamStrength(home),
            oppStrength: this.estimateTeamStrength(away),
            result: homeWin ? 1 : 0,
            pointDiff: margin,
            streak: home.streak,
        });
        const awayFormNext = this.computeTeamFormAfterGame({
            teamForm: away.form,
            teamStrength: this.estimateTeamStrength(away),
            oppStrength: this.estimateTeamStrength(home),
            result: awayWin ? 1 : 0,
            pointDiff: -margin,
            streak: away.streak,
        });
        home.form = homeFormNext;
        away.form = awayFormNext;
        home.last5 = this.pushLast5(home.last5, homeWin ? "W" : "L");
        away.last5 = this.pushLast5(away.last5, awayWin ? "W" : "L");
        home.streak = this.nextStreak(home.streak, homeWin);
        away.streak = this.nextStreak(away.streak, awayWin);
        home.offenseRating = this.clamp(Math.round(home.offenseRating * 0.9 + homeScore * 0.1), 60, 130);
        away.offenseRating = this.clamp(Math.round(away.offenseRating * 0.9 + awayScore * 0.1), 60, 130);
        home.defenseRating = this.clamp(Math.round(home.defenseRating * 0.9 + awayScore * 0.1), 60, 130);
        away.defenseRating = this.clamp(Math.round(away.defenseRating * 0.9 + homeScore * 0.1), 60, 130);
    }
    estimateTeamStrength(teamState) {
        const offense = teamState.offenseRating ?? 85;
        const defense = teamState.defenseRating ?? 85;
        const defenseQuality = 130 - defense; // lower allowed score -> better defense
        return (offense * 0.55) + (defenseQuality * 0.45) + (teamState.form - 50) * 0.08;
    }
    computeTeamFormAfterGame(params) {
        const K = 12;
        const x = (params.teamStrength - params.oppStrength) / K;
        const expectedWinProb = 1 / (1 + Math.exp(-x));
        const delta = (params.result - expectedWinProb) * 6;
        const streakBonus = this.clamp(params.streak, -5, 5) * 0.5;
        const marginAdj = this.clamp(params.pointDiff, -15, 15) * 0.08;
        const meanRevert = (50 - params.teamForm) * 0.02;
        return this.clamp(Math.round(params.teamForm + delta + streakBonus + marginAdj + meanRevert), 0, 100);
    }
    applyDailyTeamFormDecay(data, todaysGames) {
        data.teamState = data.teamState ?? {};
        const played = new Set();
        for (const game of todaysGames) {
            played.add(game.homeTeamId);
            played.add(game.awayTeamId);
        }
        for (const [key, state] of Object.entries(data.teamState)) {
            const teamId = Number(key);
            if (played.has(teamId))
                continue;
            state.form = this.clamp(Math.round(state.form + (50 - state.form) * 0.05), 0, 100);
            if (typeof state.offenseRating === "number") {
                state.offenseRating = this.clamp(Math.round(state.offenseRating + (85 - state.offenseRating) * 0.03), 60, 130);
            }
            if (typeof state.defenseRating === "number") {
                state.defenseRating = this.clamp(Math.round(state.defenseRating + (85 - state.defenseRating) * 0.03), 60, 130);
            }
        }
    }
    pushLast5(last5, result) {
        return `${last5}${result}`.slice(-5);
    }
    nextStreak(streak, win) {
        if (win) {
            return streak >= 0 ? streak + 1 : 1;
        }
        return streak <= 0 ? streak - 1 : -1;
    }
    computePlayerPerformanceScore(stat) {
        const pos = String(stat.position ?? "SF").toUpperCase();
        const z = (value, mean, std) => (value - mean) / (std || 1);
        const ptsZ = z(stat.points, 14, 8);
        const astZ = z(stat.assists, 4, 3);
        const rebZ = z(stat.rebounds, 5, 3);
        const stlZ = z(stat.stl, 1, 0.8);
        const blkZ = z(stat.blk, 0.7, 0.9);
        const tovZ = z(stat.turnovers, 2, 1.3);
        const weights = pos.includes("PG")
            ? { pts: 0.35, ast: 0.35, reb: 0.1, stl: 0.1, blk: 0.05, tov: -0.25 }
            : pos.includes("SG")
                ? { pts: 0.45, ast: 0.2, reb: 0.1, stl: 0.1, blk: 0.05, tov: -0.2 }
                : pos.includes("PF")
                    ? { pts: 0.25, ast: 0.1, reb: 0.3, stl: 0.1, blk: 0.15, tov: -0.1 }
                    : pos.includes("C")
                        ? { pts: 0.2, ast: 0.05, reb: 0.35, stl: 0.05, blk: 0.25, tov: -0.08 }
                        : { pts: 0.35, ast: 0.15, reb: 0.2, stl: 0.1, blk: 0.1, tov: -0.15 };
        const performanceIndex = ptsZ * weights.pts +
            astZ * weights.ast +
            rebZ * weights.reb +
            stlZ * weights.stl +
            blkZ * weights.blk +
            tovZ * weights.tov;
        return this.clamp(Math.round(50 + performanceIndex * 10), 0, 100);
    }
    applyOverallDrift(params) {
        const rolling30 = params.formHistory.slice(-30);
        if (rolling30.length < 30 || params.gamesSinceDrift < 20) {
            return { effectiveOverall: params.effectiveOverall, gamesSinceDrift: params.gamesSinceDrift };
        }
        const avg = rolling30.reduce((sum, v) => sum + v, 0) / rolling30.length;
        const floor = params.age >= 35 ? 55 : 50;
        const ceiling = params.age <= 24 ? Math.min(99, params.potential + 2) : params.potential;
        let effectiveOverall = params.effectiveOverall;
        if (avg > params.baseOverall + 8 && effectiveOverall < ceiling) {
            effectiveOverall += 1;
            return { effectiveOverall: this.clamp(effectiveOverall, floor, ceiling), gamesSinceDrift: 0 };
        }
        if (avg < params.baseOverall - 8 && effectiveOverall > floor) {
            effectiveOverall -= 1;
            return { effectiveOverall: this.clamp(effectiveOverall, floor, ceiling), gamesSinceDrift: 0 };
        }
        return { effectiveOverall, gamesSinceDrift: params.gamesSinceDrift };
    }
    deriveInitialPerfBonus(advanced, recentScores) {
        const recentAvg = recentScores.length > 0
            ? recentScores.reduce((sum, v) => sum + v, 0) / recentScores.length
            : 0;
        const advSignal = advanced
            ? ((advanced.per ?? 15) - 15) * 0.8
                + (advanced.bpm ?? 0) * 1.4
                + (advanced.vorp ?? 0) * 0.8
                + ((advanced.tsPercent ?? 0.56) - 0.56) * 50
                + ((advanced.usgPercent ?? 20) - 20) * 0.25
            : 0;
        return this.clamp(Math.round(advSignal + recentAvg * 0.9), -12, 16);
    }
    deterministicNoise(seed, min, max) {
        const x = Math.sin(seed * 12.9898) * 43758.5453;
        const frac = x - Math.floor(x);
        return Math.round(min + frac * (max - min));
    }
    getAgeFromBirthDate(birthDate) {
        if (!birthDate)
            return 27;
        const now = new Date();
        let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
        const m = now.getUTCMonth() - birthDate.getUTCMonth();
        if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate()))
            age -= 1;
        return this.clamp(age, 18, 42);
    }
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    async buildInitialRotation(teamId) {
        if (!teamId) {
            return {};
        }
        const players = await prisma_1.default.player.findMany({
            where: { teamId },
            select: { id: true, position: true },
            orderBy: [{ overall: "desc" }, { potential: "desc" }],
            take: 12,
        });
        const pick = (token) => players.find((p) => (p.position ?? "").includes(token))?.id ?? null;
        return {
            PG: pick("PG") ?? players[0]?.id ?? null,
            SG: pick("SG") ?? players[1]?.id ?? null,
            SF: pick("SF") ?? players[2]?.id ?? null,
            PF: pick("PF") ?? players[3]?.id ?? null,
            C: pick("C") ?? players[4]?.id ?? null,
        };
    }
}
exports.SavesService = SavesService;
//# sourceMappingURL=saves.service.js.map
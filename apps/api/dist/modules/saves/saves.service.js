"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavesService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../common/errors/AppError");
const advanceDay_1 = require("../../engine/calendar/advanceDay");
const simulateGame_1 = require("../../engine/simulation/simulateGame");
const trades_service_1 = require("../trades/trades.service");
const fixtureCsvLoader_1 = require("../fixtures/fixtureCsvLoader");
const gameweekCalendar_1 = require("../fixtures/gameweekCalendar");
const loadDetailedPositions_1 = require("../../data/loadDetailedPositions");
const fixtureStatus_1 = require("../fixtures/fixtureStatus");
const fixtureModel_1 = require("../fixtures/fixtureModel");
const ET_TIMEZONE = "America/New_York";
const FREE_AGENT_TEAM_SHORT = "FA";
function getDateKeyEt(dateValue) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: ET_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(dateValue);
}
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
            week: (0, gameweekCalendar_1.getGameweekForDate)(season, startDate),
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
                offenseStyle: "balanced",
                defenseMode: "man",
                instructions: {
                    fastBreak: true,
                    pressAfterMade: false,
                    isoStars: false,
                    crashBoards: true,
                },
                boards: {
                    attack: {
                        PG: { playerId: null, x: 0.25, y: 0.7 },
                        SG: { playerId: null, x: 0.4, y: 0.75 },
                        SF: { playerId: null, x: 0.6, y: 0.72 },
                        PF: { playerId: null, x: 0.55, y: 0.55 },
                        C: { playerId: null, x: 0.5, y: 0.35 },
                    },
                    transition: {
                        PG: { playerId: null, x: 0.5, y: 0.76 },
                        SG: { playerId: null, x: 0.3, y: 0.62 },
                        SF: { playerId: null, x: 0.7, y: 0.62 },
                        PF: { playerId: null, x: 0.42, y: 0.48 },
                        C: { playerId: null, x: 0.58, y: 0.48 },
                    },
                    defense: {
                        PG: { playerId: null, x: 0.45, y: 0.68 },
                        SG: { playerId: null, x: 0.62, y: 0.68 },
                        SF: { playerId: null, x: 0.5, y: 0.55 },
                        PF: { playerId: null, x: 0.36, y: 0.4 },
                        C: { playerId: null, x: 0.64, y: 0.4 },
                    },
                },
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
            rosterManagement: {
                tradeBlockPlayerIds: [],
                developmentLeaguePlayerIds: [],
                comparePlayerIds: [],
                playerRoles: {},
            },
            ownerManagement: await this.buildInitialOwnerManagement({
                managedTeamId: managedTeam?.id ?? null,
                season: season,
                startDate,
            }),
            managerCareer: {
                yearsManaged: 1,
                playoffAppearances: 0,
                championships: 0,
                totalWins: 0,
                totalLosses: 0,
                awards: [],
                milestones: [{
                        date: startDate,
                        title: "Hired as Head Coach",
                        detail: `Took charge of ${managedTeam?.name ?? "the franchise"}.`,
                        type: "career",
                    }],
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
        await this.upsertOwnerGoals({
            saveId: save.id,
            season: save.season,
            goals: payload.ownerManagement?.goals ?? [],
        });
        await this.appendJobSecurityEvents({
            saveId: save.id,
            events: payload.ownerManagement?.history ?? [],
        });
        await this.upsertManagerCareerSnapshot({
            saveId: save.id,
            season: save.season,
            wins: 0,
            losses: 0,
            managerCareer: payload.managerCareer ?? {
                yearsManaged: 1,
                playoffAppearances: 0,
                championships: 0,
                totalWins: 0,
                totalLosses: 0,
                awards: [],
                milestones: [],
            },
        });
        await this.persistMonthlyTeamMetricsSnapshot({
            saveId: save.id,
            season: save.season,
            monthKey: startDate.slice(0, 7),
        });
        await this.createInitialInboxMessages(save.id, startDate);
        await this.generateScheduleForSave(save.id, season);
        return save;
    }
    async getSaveById(id) {
        const save = await prisma_1.default.save.findFirst({
            where: { id, deletedAt: null },
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
            where: { deletedAt: null },
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
                    status: { in: fixtureStatus_1.UPCOMING_GAME_STATUSES },
                    OR: [{ homeTeamId: save.teamId }, { awayTeamId: save.teamId }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "asc" },
            });
            lastResult = await prisma_1.default.game.findFirst({
                where: {
                    saveId: save.id,
                    status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
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
            nextMatch: nextMatch ? (0, fixtureModel_1.toFixtureModel)(nextMatch) : null,
            lastResult: lastResult ? (0, fixtureModel_1.toFixtureModel)(lastResult) : null,
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
        await this.ensureOwnerManagementState(save, currentData);
        const currentDate = new Date(currentData.currentDate ?? save.currentDate.toISOString().slice(0, 10));
        const currentDateEtKey = String(currentData.currentDate ?? currentDate.toISOString().slice(0, 10));
        const dayCandidates = await prisma_1.default.game.findMany({
            where: {
                saveId: save.id,
                status: { in: fixtureStatus_1.SIMULATABLE_GAME_STATUSES },
            },
            include: {
                homeTeam: { include: { players: true } },
                awayTeam: { include: { players: true } },
            },
        });
        const todaysGames = dayCandidates.filter((game) => getDateKeyEt(game.gameDate) === currentDateEtKey);
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
                offensiveRating: true,
                defensiveRating: true,
                physicalRating: true,
                iqRating: true,
                attributes: true,
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
                    status: "simulated",
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
                const teamFormSupport = (playerTeamState.form - 50) * 0.04;
                const streakSupport = this.clamp(playerTeamState.streak ?? 0, -5, 5) * 0.25;
                const resultBonus = didWin ? 1.0 : -0.2;
                const moraleSupport = ((prev.morale ?? 65) - 50) * 0.04;
                const fatigueDrag = Math.max(0, (prev.fatigue ?? 10) - 60) * 0.05;
                const trainingSupport = personalFocus === "fitness" ? 1.0 : personalFocus ? 0.5 : 0;
                const targetForm = this.clamp(Math.round(perfScore + teamFormSupport + streakSupport + resultBonus + moraleSupport + trainingSupport - fatigueDrag), 35, 95);
                // More inertia than before so form does not collapse to ~50 after a few average games.
                const nextForm = this.clamp(Math.round(prev.form * 0.94 + targetForm * 0.06), 0, 100);
                const formHistory = [...(prev.formHistory ?? []), nextForm].slice(-30);
                currentData.playerState[key] = {
                    fatigue: Math.min(100, prev.fatigue + fatigueBump),
                    morale: Math.max(0, Math.min(100, prev.morale + (didWin ? 0.5 : -0.2) + (perfScore >= 65 ? 0.5 : perfScore <= 40 ? -0.5 : 0))),
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
        currentData.week = (0, gameweekCalendar_1.getGameweekForDate)(save.season, currentData.currentDate);
        const rolledWeek = (currentData.week ?? 1) > previousWeek;
        const trainingRating = Math.max(60, Math.min(95, (currentData.training?.rating ?? 74) + (Math.random() > 0.5 ? 1 : -1)));
        currentData.training = {
            ...(currentData.training ?? {}),
            rating: trainingRating,
            trend: trainingRating >= 75 ? "up" : "steady",
        };
        this.applyDailyTrainingEffects(currentData, nextDate, rolledWeek, playerPlanByPlayerId);
        if (rolledWeek) {
            await this.applyWeeklyFreeAgentOverallDecay(currentData.week ?? previousWeek + 1);
        }
        await this.applyFormTrendAndSyncPlayers({
            data: currentData,
            playerMetaById,
            playedToday,
        });
        if (rolledWeek) {
            await this.applyGameweekPerformanceAdjustments({
                saveId: save.id,
                managedTeamId: save.teamId ?? null,
                season: save.season,
                completedWeek: previousWeek,
                currentData,
            });
        }
        const nextSeasonDay = this.getSeasonDay(save.season, nextDate);
        await this.tradesService.resolvePendingOffersForDay(save.id, nextSeasonDay, nextDate);
        await this.tradesService.resolvePendingPlayerProposalResponsesForDay(save.id, nextSeasonDay, nextDate);
        await this.tradesService.resolvePendingContractOffersForDay(save.id, nextSeasonDay, nextDate);
        await this.tradesService.resolvePendingTradeProposalsForDay(save.id, nextSeasonDay, nextDate);
        await this.tradesService.snapshotTeamCapsForDay(save.id, nextSeasonDay);
        // Transfer execution may update Save.data.transferState inside TradesService.
        // Refresh and merge it here so the final save update below does not overwrite it with stale currentData.
        {
            const refreshed = await prisma_1.default.save.findFirst({
                where: { id: save.id, deletedAt: null },
                select: { data: true },
            });
            const refreshedPayload = (refreshed?.data ?? {});
            if (refreshedPayload.transferState) {
                currentData.transferState = refreshedPayload.transferState;
            }
        }
        await this.generateDailyInbox(save.id, nextDate, todaysGames.length);
        await this.runOwnerManagementLoop({
            save,
            data: currentData,
            date: nextDate,
            rolledWeek,
        });
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
    async applyWeeklyFreeAgentOverallDecay(currentWeek) {
        const freeAgentTeam = await prisma_1.default.team.findUnique({
            where: { shortName: FREE_AGENT_TEAM_SHORT },
            select: { id: true },
        });
        if (!freeAgentTeam)
            return;
        const freeAgents = await prisma_1.default.player.findMany({
            where: {
                active: true,
                teamId: freeAgentTeam.id,
            },
            select: {
                id: true,
                overall: true,
                overallCurrent: true,
            },
        });
        if (freeAgents.length === 0)
            return;
        const updates = freeAgents.map((player) => {
            const drop = 1 + ((player.id + currentWeek) % 2); // 1 or 2 each rolled week
            const curr = player.overallCurrent ?? player.overall ?? 60;
            const next = this.clamp(curr - drop, 45, 99);
            return prisma_1.default.player.update({
                where: { id: player.id },
                data: {
                    overallCurrent: next,
                    overall: next,
                },
            });
        });
        await prisma_1.default.$transaction(updates);
    }
    async advanceSaveToDate(id, targetDate, includeTargetDay = false) {
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
            if (includeTargetDay ? currentDate > parsed : currentDate >= parsed)
                break;
            current = await this.advanceSave(id);
            iterations += 1;
        }
        return current;
    }
    async deleteSave(id) {
        await this.getSaveById(id);
        return prisma_1.default.save.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
    async getInbox(id, take = 30, skip = 0) {
        const save = await this.getSaveById(id);
        const data = (save.data ?? {});
        const normalizedTake = Math.max(1, Math.min(200, Number.isFinite(take) ? Number(take) : 30));
        const normalizedSkip = Math.max(0, Number.isFinite(skip) ? Number(skip) : 0);
        const managedPlayers = save.teamId
            ? await prisma_1.default.player.findMany({
                where: { teamId: save.teamId, active: true },
                select: { id: true, name: true },
            })
            : [];
        const playerIdByName = new Map(managedPlayers.map((p) => [String(p.name).toLowerCase().trim(), p.id]));
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
            messages: messages.map((m) => {
                const interaction = this.getInboxInteraction({
                    message: m,
                    saveData: data,
                    playerIdByName,
                });
                return {
                    id: String(m.id),
                    subject: m.title,
                    body: m.body,
                    from: m.fromName,
                    createdAt: m.date.toISOString().slice(0, 10),
                    type: m.type,
                    read: m.isRead,
                    preview: String(m.body ?? "").slice(0, 120),
                    needsResponse: interaction.needsResponse,
                    responded: interaction.responded,
                    responseId: interaction.responseId ?? null,
                    choices: interaction.choices,
                };
            }),
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
        const games = await prisma_1.default.game.findMany({
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
        return games.map(fixtureModel_1.toFixtureModel);
    }
    async getResults(id) {
        const save = await this.getSaveById(id);
        const games = await prisma_1.default.game.findMany({
            where: {
                saveId: save.id,
                status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                ...(save.teamId ? { OR: [{ homeTeamId: save.teamId }, { awayTeamId: save.teamId }] } : {}),
            },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
            orderBy: { gameDate: "desc" },
            take: 100,
        });
        return games.map(fixtureModel_1.toFixtureModel);
    }
    async getResultDetails(id, gameId) {
        const save = await this.getSaveById(id);
        const game = await prisma_1.default.game.findFirst({
            where: {
                id: gameId,
                saveId: save.id,
                status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
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
    getInboxInteraction(params) {
        const responses = params.saveData.inboxState?.responses ?? {};
        const responseState = responses[String(params.message.id)];
        const responded = Boolean(responseState?.responseId);
        const normalizedType = String(params.message.type || "").toLowerCase();
        const fromNameKey = String(params.message.fromName || "").toLowerCase().trim();
        const playerId = params.playerIdByName.get(fromNameKey) ?? null;
        let choices = [];
        if (normalizedType === "player" || playerId) {
            choices = [
                { id: "supportive", label: "You are playing great, keep it up.", moraleDelta: 2 },
                { id: "neutral", label: "Keep working hard and be patient.", moraleDelta: 0 },
                { id: "critical", label: "You need to improve, no promises.", moraleDelta: -2 },
            ];
        }
        else if (normalizedType === "staff") {
            choices = [
                { id: "approve", label: "Proceed with this plan." },
                { id: "hold", label: "Hold for now, monitor the situation." },
            ];
        }
        else if (normalizedType === "scouting") {
            choices = [
                { id: "shortlist", label: "Add this player to shortlist." },
                { id: "ignore", label: "Ignore this report for now." },
            ];
        }
        else if (normalizedType === "media") {
            choices = [
                { id: "accept", label: "Accept interview request." },
                { id: "decline", label: "Decline and stay focused on basketball." },
            ];
        }
        return {
            needsResponse: choices.length > 0,
            responded,
            responseId: responseState?.responseId ?? null,
            playerId,
            choices,
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
        const save = await prisma_1.default.save.findFirst({ where: { id: saveId, deletedAt: null } });
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
    async respondInboxMessage(saveId, msgId, responseId) {
        const save = await this.getSaveById(saveId);
        const message = await prisma_1.default.inboxMessage.findFirst({
            where: { id: msgId, saveId },
        });
        if (!message)
            throw new AppError_1.NotFoundError("InboxMessage");
        const data = (save.data ?? {});
        const managedPlayers = save.teamId
            ? await prisma_1.default.player.findMany({
                where: { teamId: save.teamId, active: true },
                select: { id: true, name: true, morale: true },
            })
            : [];
        const playerIdByName = new Map(managedPlayers.map((p) => [String(p.name).toLowerCase().trim(), p.id]));
        const interaction = this.getInboxInteraction({
            message,
            saveData: data,
            playerIdByName,
        });
        if (!interaction.needsResponse) {
            throw new AppError_1.BadRequestError("This message does not require a response");
        }
        if (interaction.responded) {
            return { success: true, alreadyResponded: true };
        }
        const selected = interaction.choices.find((c) => c.id === responseId);
        if (!selected) {
            throw new AppError_1.BadRequestError("Invalid inbox response option");
        }
        data.inboxState = data.inboxState ?? {};
        data.inboxState.responses = data.inboxState.responses ?? {};
        data.inboxState.responses[String(msgId)] = {
            responseId: selected.id,
            respondedAt: new Date().toISOString(),
            playerId: interaction.playerId ?? undefined,
            moraleDelta: selected.moraleDelta ?? 0,
        };
        let moraleDeltaApplied = 0;
        if (interaction.playerId && Number.isFinite(selected.moraleDelta)) {
            const player = managedPlayers.find((p) => p.id === interaction.playerId)
                ?? await prisma_1.default.player.findUnique({ where: { id: interaction.playerId }, select: { id: true, morale: true } });
            if (player) {
                const nextMorale = this.clamp(Math.round((player.morale ?? 65) + (selected.moraleDelta ?? 0)), 0, 100);
                await prisma_1.default.player.update({
                    where: { id: player.id },
                    data: { morale: nextMorale },
                });
                data.playerState = data.playerState ?? {};
                const key = String(player.id);
                const prev = data.playerState[key] ?? { fatigue: 10, morale: 65, form: 60 };
                data.playerState[key] = {
                    ...prev,
                    morale: this.clamp(Math.round((prev.morale ?? nextMorale) + (selected.moraleDelta ?? 0)), 0, 100),
                };
                moraleDeltaApplied = selected.moraleDelta ?? 0;
            }
        }
        await prisma_1.default.inboxMessage.update({
            where: { id: msgId },
            data: { isRead: true },
        });
        const unread = await prisma_1.default.inboxMessage.count({
            where: { saveId, isRead: false },
        });
        data.inboxUnread = unread;
        await prisma_1.default.save.update({
            where: { id: saveId },
            data: { data },
        });
        return {
            success: true,
            unread,
            messageId: msgId,
            responseId: selected.id,
            moraleDelta: moraleDeltaApplied,
            playerId: interaction.playerId ?? null,
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
        const save = await prisma_1.default.save.findFirst({ where: { id: saveId, deletedAt: null } });
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
    async saveTactics(saveId, tactics, rotation) {
        const save = await this.getSaveById(saveId);
        const data = (save.data ?? {});
        const nextTactics = {
            pace: "balanced",
            threePtFocus: 50,
            defenseScheme: "switch",
            offenseStyle: "balanced",
            defenseMode: "man",
            instructions: {
                fastBreak: true,
                pressAfterMade: false,
                isoStars: false,
                crashBoards: true,
            },
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
        if (nextTactics.boards) {
            const existingBoards = (data.tactics?.boards ?? {});
            const sanitizeNamedBoard = (board) => {
                if (!board || typeof board !== "object")
                    return undefined;
                return Object.fromEntries(Object.entries(board).map(([slot, value]) => {
                    const v = value ?? { playerId: null, x: 0.5, y: 0.5 };
                    return [slot, {
                            playerId: typeof v.playerId === "number" ? v.playerId : null,
                            x: Math.max(0, Math.min(1, Number(v.x ?? 0.5))),
                            y: Math.max(0, Math.min(1, Number(v.y ?? 0.5))),
                        }];
                }));
            };
            nextTactics.boards = {
                attack: sanitizeNamedBoard(nextTactics.boards.attack) ?? existingBoards?.attack ?? nextTactics.board,
                transition: sanitizeNamedBoard(nextTactics.boards.transition) ?? existingBoards?.transition ?? nextTactics.board,
                defense: sanitizeNamedBoard(nextTactics.boards.defense) ?? existingBoards?.defense ?? nextTactics.board,
            };
        }
        nextTactics.defenseMode = nextTactics.defenseMode === "zone" || nextTactics.defenseMode === "hybrid" ? nextTactics.defenseMode : "man";
        nextTactics.offenseStyle = (nextTactics.offenseStyle === "pick_and_roll"
            || nextTactics.offenseStyle === "post_up"
            || nextTactics.offenseStyle === "transition"
            || nextTactics.offenseStyle === "iso")
            ? nextTactics.offenseStyle
            : "balanced";
        nextTactics.instructions = {
            fastBreak: Boolean(nextTactics.instructions?.fastBreak),
            pressAfterMade: Boolean(nextTactics.instructions?.pressAfterMade),
            isoStars: Boolean(nextTactics.instructions?.isoStars),
            crashBoards: Boolean(nextTactics.instructions?.crashBoards),
        };
        data.tactics = nextTactics;
        if (rotation) {
            data.rotation = rotation;
        }
        const updated = await prisma_1.default.save.update({
            where: { id: saveId },
            data: { data },
        });
        return {
            success: true,
            tactics: updated.data.tactics ?? nextTactics,
            rotation: updated.data.rotation ?? data.rotation ?? {},
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
        const normalizedWeekPlan = data.training.weekPlan ?? this.buildDefaultWeekPlan();
        const updated = await prisma_1.default.save.update({
            where: { id: saveId },
            data: { data },
        });
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        await prisma_1.default.$transaction(days.map((day) => {
            const row = normalizedWeekPlan[day] ?? this.buildDefaultWeekPlan()[day];
            return prisma_1.default.teamTrainingDayPlan.upsert({
                where: {
                    saveId_dayOfWeek: { saveId, dayOfWeek: day },
                },
                create: {
                    saveId,
                    dayOfWeek: day,
                    intensity: row.intensity,
                    focus: row.focus,
                    durationMinutes: Number.isFinite(row.durationMinutes) ? Number(row.durationMinutes) : null,
                },
                update: {
                    intensity: row.intensity,
                    focus: row.focus,
                    durationMinutes: Number.isFinite(row.durationMinutes) ? Number(row.durationMinutes) : null,
                },
            });
        }));
        return {
            success: true,
            trainingPlan: updated.data.trainingPlan ?? data.trainingPlan,
            training: updated.data.training ?? data.training,
        };
    }
    async finalizeMatchSimulation(saveId, gameId, payload) {
        const save = await this.getSaveById(saveId);
        const game = await prisma_1.default.game.findFirst({
            where: {
                id: gameId,
                saveId: save.id,
            },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
        });
        if (!game) {
            throw new AppError_1.NotFoundError("Game");
        }
        const homeScore = Math.max(0, Math.round(Number(payload.homeScore ?? 0)));
        const awayScore = Math.max(0, Math.round(Number(payload.awayScore ?? 0)));
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
            throw new AppError_1.BadRequestError("Invalid score payload");
        }
        const toRows = (input) => {
            if (Array.isArray(input))
                return input;
            if (input && typeof input === "object")
                return Object.values(input);
            return [];
        };
        const homeRows = toRows(payload.homePlayers);
        const awayRows = toRows(payload.awayPlayers);
        const allPlayerIds = [...homeRows, ...awayRows]
            .map((row) => Number((row?.playerId ?? row?.id)))
            .filter(Number.isFinite);
        const playersById = new Map((allPlayerIds.length > 0
            ? await prisma_1.default.player.findMany({
                where: { id: { in: allPlayerIds } },
                select: { id: true, teamId: true },
            })
            : []).map((row) => [row.id, row]));
        const toGameStats = (rows, teamId) => rows.flatMap((row) => {
            const playerId = Number((row?.playerId ?? row?.id));
            if (!Number.isFinite(playerId))
                return [];
            const playerMeta = playersById.get(playerId);
            if (!playerMeta || playerMeta.teamId !== teamId)
                return [];
            const points = Math.max(0, Math.round(Number(row?.points ?? 0)));
            const fgm = Math.max(0, Math.round(Number(row?.fgm ?? 0)));
            const fga = Math.max(0, Math.round(Number(row?.fga ?? 0)));
            const tpm = Math.max(0, Math.round(Number(row?.tpm ?? row?.threePtMade ?? 0)));
            const tpa = Math.max(0, Math.round(Number(row?.tpa ?? row?.threePtAtt ?? 0)));
            const ftm = Math.max(0, Math.round(Number(row?.ftm ?? row?.ftMade ?? 0)));
            const fta = Math.max(0, Math.round(Number(row?.fta ?? row?.ftAtt ?? 0)));
            const rebounds = Math.max(0, Math.round(Number(row?.rebounds ?? row?.reb ?? 0)));
            const oreb = Math.max(0, Math.round(Number(row?.oreb ?? 0)));
            const dreb = Math.max(0, Math.round(Number(row?.dreb ?? Math.max(0, rebounds - oreb))));
            return [{
                    gameId,
                    playerId,
                    teamId,
                    minutes: Math.max(0, Math.round(Number(row?.minutes ?? 0))),
                    points,
                    twoPtMade: Math.max(0, fgm - tpm),
                    twoPtAtt: Math.max(0, fga - tpa),
                    threePtMade: tpm,
                    threePtAtt: tpa,
                    ftMade: ftm,
                    ftAtt: fta,
                    dunks: Math.max(0, Math.round(Number(row?.dunks ?? 0))),
                    oreb,
                    dreb,
                    rebounds,
                    assists: Math.max(0, Math.round(Number(row?.assists ?? row?.ast ?? 0))),
                    steals: Math.max(0, Math.round(Number(row?.steals ?? row?.stl ?? 0))),
                    blocks: Math.max(0, Math.round(Number(row?.blocks ?? row?.blk ?? 0))),
                    turnovers: Math.max(0, Math.round(Number(row?.turnovers ?? row?.tov ?? 0))),
                    fouls: Math.max(0, Math.round(Number(row?.fouls ?? 0))),
                    plusMinus: Math.round(Number(row?.plusMinus ?? 0)) || 0,
                    performanceRating: Number(row?.performanceRating ?? 0) || 0,
                }];
        });
        const gameStatsPayload = [
            ...toGameStats(homeRows, game.homeTeamId),
            ...toGameStats(awayRows, game.awayTeamId),
        ];
        await prisma_1.default.$transaction(async (tx) => {
            await tx.game.update({
                where: { id: game.id },
                data: {
                    status: "simulated",
                    homeScore,
                    awayScore,
                },
            });
            await tx.gameStat.deleteMany({ where: { gameId: game.id } });
            if (gameStatsPayload.length > 0) {
                await tx.gameStat.createMany({
                    data: gameStatsPayload,
                });
            }
        });
        return {
            success: true,
            game: (0, fixtureModel_1.toFixtureModel)({
                ...game,
                status: "simulated",
                homeScore,
                awayScore,
            }),
        };
    }
    async saveRosterManagement(saveId, payload) {
        const save = await this.getSaveById(saveId);
        const data = (save.data ?? {});
        const toUniqueIds = (value) => {
            if (!Array.isArray(value))
                return [];
            return [...new Set(value.map((v) => Number(v)).filter(Number.isFinite))];
        };
        const next = {
            tradeBlockPlayerIds: toUniqueIds(payload.tradeBlockPlayerIds ?? data.rosterManagement?.tradeBlockPlayerIds ?? []),
            developmentLeaguePlayerIds: toUniqueIds(payload.developmentLeaguePlayerIds ?? data.rosterManagement?.developmentLeaguePlayerIds ?? []),
            comparePlayerIds: toUniqueIds(payload.comparePlayerIds ?? data.rosterManagement?.comparePlayerIds ?? []).slice(0, 2),
            playerRoles: {
                ...(data.rosterManagement?.playerRoles ?? {}),
                ...(payload.playerRoles ?? {}),
            },
        };
        data.rosterManagement = next;
        const updated = await prisma_1.default.save.update({
            where: { id: saveId },
            data: { data },
        });
        return {
            success: true,
            rosterManagement: updated.data.rosterManagement ?? next,
        };
    }
    async getTrainingConfig(saveId) {
        const save = await this.getSaveById(saveId);
        const data = (save.data ?? {});
        const persistedDayPlans = await prisma_1.default.teamTrainingDayPlan.findMany({
            where: { saveId },
            orderBy: { dayOfWeek: "asc" },
        });
        const dbWeekPlan = Object.fromEntries(persistedDayPlans.map((row) => [
            row.dayOfWeek,
            {
                intensity: row.intensity,
                focus: row.focus,
                durationMinutes: row.durationMinutes ?? undefined,
            },
        ]));
        const mergedWeekPlan = { ...this.buildDefaultWeekPlan() };
        for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
            const mergedRow = {
                ...(mergedWeekPlan[day] ?? {}),
                ...(data.training?.weekPlan?.[day] ?? {}),
                ...(dbWeekPlan?.[day] ?? {}),
            };
            mergedWeekPlan[day] = {
                intensity: mergedRow.intensity ?? "balanced",
                focus: mergedRow.focus ?? "balanced",
                intensityPercent: Number.isFinite(mergedRow.intensityPercent) ? Number(mergedRow.intensityPercent) : undefined,
                durationMinutes: Number.isFinite(mergedRow.durationMinutes) ? Number(mergedRow.durationMinutes) : undefined,
            };
        }
        return {
            success: true,
            trainingPlan: data.trainingPlan ?? { intensity: "balanced", focus: "balanced" },
            training: {
                rating: data.training?.rating ?? 74,
                trend: data.training?.trend ?? "steady",
                teamProfiles: data.training?.teamProfiles ?? [],
                activeTeamProfileId: data.training?.activeTeamProfileId ?? null,
                weekPlan: mergedWeekPlan,
                playerPlans: data.training?.playerPlans ?? {},
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
                dayPlan: plan.dayPlan ?? null,
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
                dayPlan: payload.dayPlan != null ? payload.dayPlan : undefined,
            },
            update: {
                focus,
                intensity,
                dayPlan: payload.dayPlan != null ? payload.dayPlan : undefined,
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
                status: { in: fixtureStatus_1.UPCOMING_GAME_STATUSES },
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
        const managedPlayers = managedTeam.players.map((player) => ({
            ...player,
            position: (0, loadDetailedPositions_1.resolveDetailedPosition)(player.name, managedTeam.shortName, player.position) ?? player.position,
        }));
        const opponentPlayers = opponentTeam.players.map((player) => ({
            ...player,
            position: (0, loadDetailedPositions_1.resolveDetailedPosition)(player.name, opponentTeam.shortName, player.position) ?? player.position,
        }));
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
                managed: this.getManagedProbableStarters(payload, managedPlayers),
                opponent: this.getDefaultProbableStarters(opponentPlayers),
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
        await this.ensureOwnerManagementState(save, payload);
        const managedTeamId = save.managedTeamId ?? save.teamId ?? null;
        const team = managedTeamId
            ? await prisma_1.default.team.findUnique({
                where: { id: managedTeamId },
                select: {
                    id: true,
                    name: true,
                    shortName: true,
                    conference: true,
                },
            })
            : null;
        const nextMatch = team
            ? await prisma_1.default.game.findFirst({
                where: {
                    saveId: save.id,
                    status: { in: fixtureStatus_1.UPCOMING_GAME_STATUSES },
                    OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "asc" },
            })
            : null;
        const upcomingFixtures = team
            ? await prisma_1.default.game.findMany({
                where: {
                    saveId: save.id,
                    status: { in: fixtureStatus_1.UPCOMING_GAME_STATUSES },
                    OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "asc" },
                take: 3,
            })
            : [];
        const recentResults = team
            ? await prisma_1.default.game.findMany({
                where: {
                    saveId: save.id,
                    status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                    OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "desc" },
                take: 3,
            })
            : [];
        const recentPerformanceGames = team
            ? await prisma_1.default.game.findMany({
                where: {
                    saveId: save.id,
                    status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                    OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
                },
                include: { homeTeam: true, awayTeam: true },
                orderBy: { gameDate: "desc" },
                take: 7,
            })
            : [];
        const conferenceStandings = await this.buildConferenceStandings(save.id);
        const standings = [...conferenceStandings.east, ...conferenceStandings.west]
            .sort((a, b) => b.pct - a.pct || b.wins - a.wins)
            .slice(0, 10);
        const currentDateStr = payload.currentDate ?? save.currentDate.toISOString().slice(0, 10);
        const currentDateUtc = new Date(`${currentDateStr}T23:59:59.999Z`);
        const currentWeek = payload.week ?? (0, gameweekCalendar_1.getGameweekForDate)(save.season, currentDateStr);
        const gameweekRanges = (0, gameweekCalendar_1.getGameweekRanges)(save.season);
        const currentRange = gameweekRanges.find((gw) => gw.week === currentWeek) ?? gameweekRanges[0];
        const weekStart = new Date(`${currentRange.start}T00:00:00.000Z`);
        const weekEnd = new Date(`${currentRange.end}T23:59:59.999Z`);
        const progressDate = currentDateUtc < weekEnd ? currentDateUtc : weekEnd;
        const [simulatedWeekGames, weekGamesTotal] = await Promise.all([
            prisma_1.default.game.count({
                where: {
                    saveId: save.id,
                    status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                    gameDate: {
                        gte: weekStart,
                        lte: progressDate,
                    },
                },
            }),
            prisma_1.default.game.count({
                where: {
                    saveId: save.id,
                    gameDate: {
                        gte: weekStart,
                        lte: progressDate,
                    },
                },
            }),
        ]);
        const scoringLeadersRaw = team
            ? await prisma_1.default.gameStat.groupBy({
                by: ["playerId"],
                where: {
                    teamId: team.id,
                    game: {
                        saveId: save.id,
                        status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                    },
                },
                _sum: { points: true },
                _count: { gameId: true },
                orderBy: { _sum: { points: "desc" } },
                take: 12,
            })
            : [];
        let leaders = [];
        if (scoringLeadersRaw.length > 0) {
            const players = await prisma_1.default.player.findMany({
                where: { id: { in: scoringLeadersRaw.map((r) => r.playerId) } },
                select: { id: true, name: true },
            });
            const playerMap = new Map(players.map((p) => [p.id, p.name]));
            leaders = scoringLeadersRaw
                .map((row) => {
                const gamesPlayed = row._count.gameId || 0;
                const totalPoints = row._sum.points ?? 0;
                return {
                    name: playerMap.get(row.playerId) ?? "Unknown",
                    value: totalPoints,
                    metric: "PTS",
                    totalPoints,
                    games: gamesPlayed,
                };
            })
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
        }
        else {
            const fallback = await prisma_1.default.player.findMany({
                where: team ? { teamId: team.id } : undefined,
                orderBy: { overall: "desc" },
                take: 5,
                select: { name: true, overall: true },
            });
            leaders = fallback.map((player) => ({
                name: player.name,
                value: 0,
                metric: "PTS",
                totalPoints: 0,
                games: 0,
            }));
        }
        const teamValueAgg = team
            ? await prisma_1.default.player.aggregate({
                where: { teamId: team.id, active: true },
                _sum: { salary: true },
            })
            : null;
        const teamValue = teamValueAgg?._sum.salary ?? 0;
        const managedConferenceStandings = team
            ? this.normalizeConference(team.conference) === "West"
                ? conferenceStandings.west
                : conferenceStandings.east
            : [];
        const managedStandingRow = team
            ? managedConferenceStandings.find((row) => row.teamId === team.id)
            : undefined;
        const conferenceRank = managedStandingRow
            ? (managedConferenceStandings.findIndex((row) => row.teamId === managedStandingRow.teamId) + 1)
            : null;
        const wins = managedStandingRow?.wins ?? 0;
        const losses = managedStandingRow?.losses ?? 0;
        const gamesPlayed = wins + losses;
        const winRate = gamesPlayed > 0 ? wins / gamesPlayed : 0;
        const recentPerformance = recentPerformanceGames
            .slice()
            .reverse()
            .map((game, idx) => ({
            label: `G${idx + 1}`,
            points: game.homeTeamId === team?.id ? game.homeScore : game.awayScore,
        }));
        const latestInbox = await prisma_1.default.inboxMessage.findMany({
            where: { saveId: id },
            orderBy: { date: "desc" },
            take: 3,
        });
        const unread = await prisma_1.default.inboxMessage.count({
            where: { saveId: id, isRead: false },
        });
        return {
            nextMatch: nextMatch ? (0, fixtureModel_1.toFixtureModel)(nextMatch) : null,
            recentResults: recentResults.map(fixtureModel_1.toFixtureModel),
            upcomingFixtures: upcomingFixtures.map(fixtureModel_1.toFixtureModel),
            standings,
            leaders,
            topScorers: leaders,
            recentPerformance,
            overview: {
                leaguePosition: conferenceRank,
                conference: managedStandingRow?.conference ?? (team ? this.normalizeConference(team.conference) : "West"),
                winRate,
                wins,
                losses,
                teamValue,
                currentWeek,
                weekRange: {
                    start: currentRange.start,
                    end: currentRange.end,
                },
                simulatedGamesInWeek: simulatedWeekGames,
                totalGamesInWeek: weekGamesTotal,
            },
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
            owner: {
                jobSecurity: payload.ownerManagement?.jobSecurity ?? 66,
                jobSecurityBand: this.getJobSecurityBand(payload.ownerManagement?.jobSecurity ?? 66),
                goals: payload.ownerManagement?.goals ?? [],
            },
        };
    }
    async getManagerProfile(id) {
        const save = await this.getSaveById(id);
        const data = (save.data ?? {});
        await this.ensureOwnerManagementState(save, data);
        const managedTeamId = save.managedTeamId ?? save.teamId ?? null;
        const team = managedTeamId
            ? await prisma_1.default.team.findUnique({
                where: { id: managedTeamId },
                select: { id: true, name: true, shortName: true, conference: true, logoPath: true },
            })
            : null;
        const currentDateIso = String(data.currentDate ?? save.currentDate.toISOString().slice(0, 10));
        const currentDate = new Date(`${currentDateIso}T00:00:00.000Z`);
        const goalEval = await this.evaluateOwnerGoalsProgress({
            save,
            data,
            date: currentDate,
        });
        const transactions = await prisma_1.default.transactionHistory.findMany({
            where: {
                saveId: save.id,
                ...(managedTeamId ? { teamId: managedTeamId } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: 120,
        });
        const [weeklySnapshots, monthlySnapshots, awards] = await Promise.all([
            managedTeamId
                ? prisma_1.default.weeklyStandingsSnapshot.findMany({
                    where: {
                        saveId: save.id,
                        season: save.season,
                        teamId: managedTeamId,
                    },
                    orderBy: { week: "asc" },
                    take: 30,
                })
                : Promise.resolve([]),
            managedTeamId
                ? prisma_1.default.monthlyTeamMetricsSnapshot.findMany({
                    where: {
                        saveId: save.id,
                        season: save.season,
                        teamId: managedTeamId,
                    },
                    orderBy: { monthKey: "asc" },
                    take: 18,
                })
                : Promise.resolve([]),
            prisma_1.default.managerAward.findMany({
                where: { saveId: save.id },
                orderBy: { awardedAt: "desc" },
                take: 20,
            }),
        ]);
        const completedDeals = transactions.filter((item) => String(item.status || "").toUpperCase() === "COMPLETED");
        const nonCompletedDeals = transactions.filter((item) => String(item.status || "").toUpperCase() !== "COMPLETED");
        const tradeCount = completedDeals.filter((item) => String(item.category || "").toUpperCase() === "TRADE").length;
        const security = data.ownerManagement?.jobSecurity ?? 66;
        const goals = data.ownerManagement?.goals ?? [];
        const reviews = data.ownerManagement?.reviews ?? [];
        const history = data.ownerManagement?.history ?? [];
        const managedWins = goalEval.managedStanding?.wins ?? 0;
        const managedLosses = goalEval.managedStanding?.losses ?? 0;
        const reviewedThisSeason = data.ownerManagement?.lastSeasonReviewSeason === save.season;
        const baseCareerWins = data.managerCareer?.totalWins ?? 0;
        const baseCareerLosses = data.managerCareer?.totalLosses ?? 0;
        const allTimeWins = reviewedThisSeason ? baseCareerWins : baseCareerWins + managedWins;
        const allTimeLosses = reviewedThisSeason ? baseCareerLosses : baseCareerLosses + managedLosses;
        const reputationBadges = [
            {
                id: "player_dev",
                label: "Player Dev",
                value: `${Math.round(((goals.find((g) => g.type === "development")?.progress ?? 0) * 100))}%`,
            },
            {
                id: "tactician",
                label: "Tactician",
                value: `${Math.round((goalEval.managedStanding?.pct ?? 0) * 100)}% Win`,
            },
            {
                id: "trader",
                label: "Trader",
                value: `${tradeCount} Deals`,
            },
            {
                id: "stability",
                label: "Stability",
                value: this.getJobSecurityBand(security),
            },
            {
                id: "achievements",
                label: "Achievements",
                value: `${awards.length} Awards`,
            },
        ];
        const timeline = [
            ...(data.managerCareer?.milestones ?? []).map((item) => ({
                date: item.date,
                title: item.title,
                detail: item.detail ?? "",
                type: item.type ?? "milestone",
            })),
            ...reviews.map((review) => ({
                date: review.date,
                title: review.title,
                detail: review.summary,
                type: "board_review",
            })),
            ...history
                .filter((item) => Math.abs(item.delta) >= 2)
                .slice(-12)
                .map((item) => ({
                date: item.date,
                title: `Job Security ${item.delta > 0 ? "Up" : "Down"} (${item.delta > 0 ? "+" : ""}${item.delta})`,
                detail: item.reason,
                type: "job_security",
            })),
            ...transactions.slice(0, 12).map((item) => ({
                date: item.createdAt.toISOString().slice(0, 10),
                title: item.title,
                detail: item.body ?? "",
                type: "transaction",
            })),
        ]
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .slice(0, 24);
        return {
            manager: {
                name: data.manager?.name ?? save.coachName ?? "Head Coach",
                avatarId: data.manager?.coachAvatar ?? save.coachAvatarId ?? "spoelstra",
                teamName: team?.name ?? "No Team",
                teamShortName: team?.shortName ?? "-",
                teamLogoPath: team?.logoPath ?? null,
                season: save.season,
                yearsManaged: data.managerCareer?.yearsManaged ?? 1,
            },
            careerRecord: {
                wins: allTimeWins,
                losses: allTimeLosses,
                playoffAppearances: data.managerCareer?.playoffAppearances ?? 0,
                championships: data.managerCareer?.championships ?? 0,
            },
            currentSeason: {
                conference: goalEval.managedStanding?.conference ?? (team ? this.normalizeConference(team.conference) : "West"),
                rank: goalEval.managedRank,
                wins: managedWins,
                losses: managedLosses,
                pct: goalEval.managedStanding?.pct ?? 0,
                streak: goalEval.managedStanding?.streak ?? "-",
                l10: goalEval.managedStanding?.l10 ?? "0-0",
            },
            jobSecurity: {
                score: security,
                band: this.getJobSecurityBand(security),
                history: history.slice(-24),
            },
            ownerGoals: goals,
            achievements: awards.map((award) => ({
                id: award.id,
                season: award.season,
                title: award.title,
                type: award.awardType,
                description: award.description ?? "",
                awardedAt: award.awardedAt.toISOString().slice(0, 10),
            })),
            reputationBadges,
            transferSummary: {
                totalMoves: transactions.length,
                completed: completedDeals.length,
                failed: nonCompletedDeals.length,
                bestDeal: completedDeals[0]
                    ? {
                        title: completedDeals[0].title,
                        detail: completedDeals[0].body ?? "",
                        date: completedDeals[0].createdAt.toISOString().slice(0, 10),
                    }
                    : null,
                worstDeal: nonCompletedDeals[0]
                    ? {
                        title: nonCompletedDeals[0].title,
                        detail: nonCompletedDeals[0].body ?? "",
                        date: nonCompletedDeals[0].createdAt.toISOString().slice(0, 10),
                    }
                    : null,
            },
            timeline,
            boardReviews: reviews,
            trendCharts: {
                standings: weeklySnapshots.map((item) => ({
                    week: item.week,
                    rank: item.rank,
                    wins: item.wins,
                    losses: item.losses,
                    pct: item.pct,
                    streak: item.streak,
                })),
                monthlyMetrics: monthlySnapshots.map((item) => ({
                    monthKey: item.monthKey,
                    payroll: item.payroll,
                    morale: item.avgMorale,
                    offenseRating: item.offenseRating,
                    defenseRating: item.defenseRating,
                    form: item.form,
                    wins: item.wins,
                    losses: item.losses,
                })),
            },
        };
    }
    async buildConferenceStandings(saveId) {
        const [teams, games] = await Promise.all([
            prisma_1.default.team.findMany({
                where: { shortName: { not: FREE_AGENT_TEAM_SHORT } },
                select: {
                    id: true,
                    name: true,
                    shortName: true,
                    conference: true,
                    division: true,
                },
            }),
            prisma_1.default.game.findMany({
                where: { saveId, status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES } },
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
                l10: "0-0",
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
            row.l10 = this.computeLastNRecord(teamGames.get(row.teamId) ?? [], 10);
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
    computeLastNRecord(results, n) {
        if (results.length === 0)
            return "0-0";
        const recent = [...results]
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, Math.max(1, n));
        const wins = recent.filter((item) => item.result === "W").length;
        const losses = recent.length - wins;
        return `${wins}-${losses}`;
    }
    async buildInitialOwnerManagement(params) {
        const defaultState = {
            jobSecurity: 66,
            history: [{
                    date: params.startDate,
                    score: 66,
                    delta: 0,
                    reason: "Initial board confidence.",
                    source: "weekly",
                }],
            goals: [],
            reviews: [],
            lastMonthlyBoardKey: params.startDate.slice(0, 7),
            lastMidSeasonReviewWeek: undefined,
            lastSeasonReviewSeason: undefined,
        };
        if (!params.managedTeamId)
            return defaultState;
        const roster = await prisma_1.default.player.findMany({
            where: { teamId: params.managedTeamId, active: true },
            select: { id: true, age: true, overallCurrent: true, overall: true, form: true, potential: true },
            orderBy: [{ potential: "desc" }, { overallCurrent: "desc" }],
            take: 15,
        });
        const averageOverall = roster.length > 0
            ? roster.reduce((sum, player) => sum + (player.overallCurrent ?? player.overall ?? 70), 0) / roster.length
            : 76;
        const winTarget = averageOverall >= 83 ? 50 : averageOverall >= 79 ? 45 : averageOverall >= 75 ? 41 : 36;
        const playoffTarget = averageOverall >= 83 ? "win_round_1" : averageOverall >= 78 ? "make_playoffs" : "play_in";
        const developmentPlayers = roster
            .filter((player) => Number(player.age ?? 30) <= 24)
            .slice(0, 2);
        const baselineOveralls = {};
        const baselineForms = {};
        for (const player of developmentPlayers) {
            baselineOveralls[String(player.id)] = player.overallCurrent ?? player.overall ?? 70;
            baselineForms[String(player.id)] = player.form ?? 60;
        }
        defaultState.goals = [
            {
                id: "owner-goal-win-target",
                type: "win_target",
                title: "Win Target",
                description: `Finish with at least ${winTarget} regular-season wins.`,
                targetNumber: winTarget,
                current: 0,
                progress: 0,
                weight: 0.36,
                status: "on_track",
            },
            {
                id: "owner-goal-playoff",
                type: "playoff_goal",
                title: "Playoff Goal",
                description: playoffTarget === "win_round_1"
                    ? "Qualify and win at least one playoff round."
                    : playoffTarget === "make_playoffs"
                        ? "Secure a playoff position."
                        : "Secure at least a play-in position.",
                targetText: playoffTarget,
                current: 0,
                progress: 0,
                weight: 0.28,
                status: "on_track",
            },
            {
                id: "owner-goal-development",
                type: "development",
                title: "Development Goal",
                description: "Improve at least 2 young players by +2 overall or strong form growth.",
                targetNumber: Math.max(1, developmentPlayers.length),
                current: 0,
                progress: 0,
                weight: 0.2,
                status: "on_track",
                meta: {
                    playerIds: developmentPlayers.map((player) => player.id),
                    baselineOveralls,
                    baselineForms,
                    overallDeltaTarget: 2,
                    formDeltaTarget: 8,
                },
            },
            {
                id: "owner-goal-financial",
                type: "financial",
                title: "Financial Goal",
                description: "Stay under the projected luxury-tax threshold.",
                targetNumber: 185000000,
                current: 0,
                progress: 0,
                weight: 0.16,
                status: "on_track",
            },
        ];
        return defaultState;
    }
    mapOwnerGoalRowToPayload(goal) {
        const meta = (goal.meta ?? {});
        const normalizedType = String(goal.type);
        return {
            id: String(meta.goalId ?? `owner-goal-${goal.id}`),
            type: normalizedType,
            title: goal.title,
            description: goal.description,
            targetNumber: goal.targetNumber ?? undefined,
            targetText: goal.targetText ?? undefined,
            current: goal.currentValue ?? 0,
            progress: goal.progress ?? 0,
            weight: goal.weight ?? 0.25,
            status: String(goal.status),
            meta,
        };
    }
    async upsertOwnerGoals(params) {
        if (!params.goals.length)
            return;
        await prisma_1.default.$transaction(params.goals.map((goal) => {
            const meta = {
                ...(goal.meta ?? {}),
                goalId: goal.id,
            };
            return prisma_1.default.ownerGoal.upsert({
                where: {
                    saveId_season_type: {
                        saveId: params.saveId,
                        season: params.season,
                        type: goal.type,
                    },
                },
                update: {
                    title: goal.title,
                    description: goal.description,
                    targetNumber: goal.targetNumber ?? null,
                    targetText: goal.targetText ?? null,
                    currentValue: Number(goal.current ?? 0),
                    progress: Number(goal.progress ?? 0),
                    weight: Number(goal.weight ?? 0.25),
                    status: String(goal.status ?? "on_track"),
                    meta,
                },
                create: {
                    saveId: params.saveId,
                    season: params.season,
                    type: goal.type,
                    title: goal.title,
                    description: goal.description,
                    targetNumber: goal.targetNumber ?? null,
                    targetText: goal.targetText ?? null,
                    currentValue: Number(goal.current ?? 0),
                    progress: Number(goal.progress ?? 0),
                    weight: Number(goal.weight ?? 0.25),
                    status: String(goal.status ?? "on_track"),
                    meta,
                },
            });
        }));
    }
    async appendJobSecurityEvents(params) {
        if (!params.events.length)
            return;
        await prisma_1.default.jobSecurityEvent.createMany({
            data: params.events.map((event) => ({
                saveId: params.saveId,
                date: new Date(`${event.date}T00:00:00.000Z`),
                score: Math.round(event.score),
                delta: Math.round(event.delta),
                reason: event.reason,
                source: String(event.source ?? "weekly"),
            })),
        });
    }
    async appendBoardReviews(params) {
        if (!params.reviews.length)
            return;
        await prisma_1.default.boardReview.createMany({
            data: params.reviews.map((review) => ({
                saveId: params.saveId,
                season: params.season,
                week: (0, gameweekCalendar_1.getGameweekForDate)(params.season, review.date),
                date: new Date(`${review.date}T00:00:00.000Z`),
                title: review.title,
                verdict: review.verdict,
                summary: review.summary,
            })),
        });
    }
    async upsertManagerCareerSnapshot(params) {
        await prisma_1.default.managerCareerStat.upsert({
            where: {
                saveId_season: {
                    saveId: params.saveId,
                    season: params.season,
                },
            },
            create: {
                saveId: params.saveId,
                season: params.season,
                yearsManaged: Number(params.managerCareer.yearsManaged ?? 1),
                wins: Number(params.wins ?? 0),
                losses: Number(params.losses ?? 0),
                playoffAppearances: Number(params.managerCareer.playoffAppearances ?? 0),
                championships: Number(params.managerCareer.championships ?? 0),
                metadata: {
                    totalWins: Number(params.managerCareer.totalWins ?? 0),
                    totalLosses: Number(params.managerCareer.totalLosses ?? 0),
                    awards: params.managerCareer.awards ?? [],
                    milestones: params.managerCareer.milestones ?? [],
                },
            },
            update: {
                yearsManaged: Number(params.managerCareer.yearsManaged ?? 1),
                wins: Number(params.wins ?? 0),
                losses: Number(params.losses ?? 0),
                playoffAppearances: Number(params.managerCareer.playoffAppearances ?? 0),
                championships: Number(params.managerCareer.championships ?? 0),
                metadata: {
                    totalWins: Number(params.managerCareer.totalWins ?? 0),
                    totalLosses: Number(params.managerCareer.totalLosses ?? 0),
                    awards: params.managerCareer.awards ?? [],
                    milestones: params.managerCareer.milestones ?? [],
                },
            },
        });
    }
    async upsertManagerAwards(params) {
        if (!params.awards.length)
            return;
        await prisma_1.default.$transaction(params.awards.map((award) => prisma_1.default.managerAward.upsert({
            where: {
                saveId_season_awardType_title: {
                    saveId: params.saveId,
                    season: params.season,
                    awardType: award.awardType,
                    title: award.title,
                },
            },
            create: {
                saveId: params.saveId,
                season: params.season,
                awardType: award.awardType,
                title: award.title,
                description: award.description ?? null,
            },
            update: {
                description: award.description ?? null,
            },
        })));
    }
    async persistWeeklyStandingsSnapshot(params) {
        const standings = await this.buildConferenceStandings(params.saveId);
        const rows = [...standings.west, ...standings.east];
        if (!rows.length)
            return;
        await prisma_1.default.weeklyStandingsSnapshot.createMany({
            data: rows.map((row) => ({
                saveId: params.saveId,
                season: params.season,
                week: params.week,
                conference: row.conference,
                teamId: row.teamId,
                rank: row.conference === "West"
                    ? standings.west.findIndex((item) => item.teamId === row.teamId) + 1
                    : standings.east.findIndex((item) => item.teamId === row.teamId) + 1,
                wins: row.wins,
                losses: row.losses,
                pct: row.pct,
                gb: row.gb,
                streak: row.streak,
                l10: row.l10,
            })),
            skipDuplicates: true,
        });
    }
    async persistMonthlyTeamMetricsSnapshot(params) {
        const teams = await prisma_1.default.team.findMany({
            where: { shortName: { not: FREE_AGENT_TEAM_SHORT } },
            select: { id: true },
        });
        if (!teams.length)
            return;
        const standings = await this.buildConferenceStandings(params.saveId);
        const standingsByTeamId = new Map([...standings.west, ...standings.east].map((row) => [row.teamId, row]));
        const teamIds = teams.map((team) => team.id);
        const roster = await prisma_1.default.player.findMany({
            where: {
                active: true,
                teamId: { in: teamIds },
            },
            select: {
                teamId: true,
                salary: true,
                morale: true,
                offensiveRating: true,
                defensiveRating: true,
                form: true,
            },
        });
        const grouped = new Map();
        for (const player of roster) {
            const list = grouped.get(player.teamId) ?? [];
            list.push(player);
            grouped.set(player.teamId, list);
        }
        await prisma_1.default.monthlyTeamMetricsSnapshot.createMany({
            data: teamIds.map((teamId) => {
                const teamRoster = grouped.get(teamId) ?? [];
                const count = Math.max(1, teamRoster.length);
                const payroll = teamRoster.reduce((sum, player) => sum + Number(player.salary ?? 0), 0);
                const avgMorale = teamRoster.reduce((sum, player) => sum + Number(player.morale ?? 65), 0) / count;
                const offenseRating = teamRoster.reduce((sum, player) => sum + Number(player.offensiveRating ?? 75), 0) / count;
                const defenseRating = teamRoster.reduce((sum, player) => sum + Number(player.defensiveRating ?? 75), 0) / count;
                const form = teamRoster.reduce((sum, player) => sum + Number(player.form ?? 60), 0) / count;
                const standing = standingsByTeamId.get(teamId);
                return {
                    saveId: params.saveId,
                    season: params.season,
                    monthKey: params.monthKey,
                    teamId,
                    payroll,
                    avgMorale: Number(avgMorale.toFixed(2)),
                    offenseRating: Number(offenseRating.toFixed(2)),
                    defenseRating: Number(defenseRating.toFixed(2)),
                    form: Number(form.toFixed(2)),
                    wins: standing?.wins ?? 0,
                    losses: standing?.losses ?? 0,
                };
            }),
            skipDuplicates: true,
        });
    }
    async runSaveIntegrityChecks(saveId) {
        const [standings, completedGames] = await Promise.all([
            this.buildConferenceStandings(saveId),
            prisma_1.default.game.findMany({
                where: {
                    saveId,
                    status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                },
                select: {
                    homeTeamId: true,
                    awayTeamId: true,
                },
            }),
        ]);
        const gamesPlayedByTeam = new Map();
        for (const game of completedGames) {
            gamesPlayedByTeam.set(game.homeTeamId, (gamesPlayedByTeam.get(game.homeTeamId) ?? 0) + 1);
            gamesPlayedByTeam.set(game.awayTeamId, (gamesPlayedByTeam.get(game.awayTeamId) ?? 0) + 1);
        }
        const mismatches = [...standings.east, ...standings.west].filter((row) => {
            const expectedPlayed = gamesPlayedByTeam.get(row.teamId) ?? 0;
            return (row.wins + row.losses) !== expectedPlayed;
        });
        return {
            ok: mismatches.length === 0,
            mismatches,
        };
    }
    async ensureOwnerManagementState(save, data) {
        const currentDate = String(data.currentDate ?? save.currentDate.toISOString().slice(0, 10));
        const managedTeamId = save.managedTeamId ?? save.teamId ?? null;
        if (!data.ownerManagement) {
            data.ownerManagement = await this.buildInitialOwnerManagement({
                managedTeamId,
                season: save.season,
                startDate: currentDate,
            });
        }
        data.ownerManagement.history = data.ownerManagement.history ?? [];
        data.ownerManagement.goals = data.ownerManagement.goals ?? [];
        data.ownerManagement.reviews = data.ownerManagement.reviews ?? [];
        data.ownerManagement.jobSecurity = this.clamp(Math.round(data.ownerManagement.jobSecurity ?? 66), 0, 100);
        data.managerCareer = data.managerCareer ?? {
            yearsManaged: 1,
            playoffAppearances: 0,
            championships: 0,
            totalWins: 0,
            totalLosses: 0,
            awards: [],
            milestones: [{
                    date: currentDate,
                    title: "Career Initialized",
                    detail: "Manager profile tracking started.",
                    type: "career",
                }],
        };
        const [goalRows, eventRows, reviewRows, careerRow, awardRows] = await Promise.all([
            prisma_1.default.ownerGoal.findMany({
                where: { saveId: save.id, season: save.season },
                orderBy: { createdAt: "asc" },
            }),
            prisma_1.default.jobSecurityEvent.findMany({
                where: { saveId: save.id },
                orderBy: { date: "asc" },
            }),
            prisma_1.default.boardReview.findMany({
                where: { saveId: save.id },
                orderBy: { date: "asc" },
            }),
            prisma_1.default.managerCareerStat.findUnique({
                where: {
                    saveId_season: {
                        saveId: save.id,
                        season: save.season,
                    },
                },
            }),
            prisma_1.default.managerAward.findMany({
                where: { saveId: save.id },
                orderBy: { awardedAt: "desc" },
            }),
        ]);
        if (goalRows.length > 0) {
            data.ownerManagement.goals = goalRows.map((goal) => this.mapOwnerGoalRowToPayload(goal));
        }
        else {
            if (!data.ownerManagement.goals.length) {
                const seeded = await this.buildInitialOwnerManagement({
                    managedTeamId,
                    season: save.season,
                    startDate: currentDate,
                });
                data.ownerManagement.goals = seeded.goals ?? [];
            }
            await this.upsertOwnerGoals({
                saveId: save.id,
                season: save.season,
                goals: data.ownerManagement.goals ?? [],
            });
        }
        if (eventRows.length > 0) {
            data.ownerManagement.history = eventRows.map((event) => ({
                date: event.date.toISOString().slice(0, 10),
                score: event.score,
                delta: event.delta,
                reason: event.reason,
                source: String(event.source),
            }));
            data.ownerManagement.jobSecurity = this.clamp(Math.round(eventRows[eventRows.length - 1]?.score ?? data.ownerManagement.jobSecurity ?? 66), 0, 100);
        }
        else {
            if (!data.ownerManagement.history.length) {
                data.ownerManagement.history = [{
                        date: currentDate,
                        score: data.ownerManagement.jobSecurity ?? 66,
                        delta: 0,
                        reason: "Initial board confidence.",
                        source: "weekly",
                    }];
            }
            await this.appendJobSecurityEvents({
                saveId: save.id,
                events: data.ownerManagement.history,
            });
        }
        if (reviewRows.length > 0) {
            data.ownerManagement.reviews = reviewRows.map((review) => ({
                date: review.date.toISOString().slice(0, 10),
                title: review.title,
                verdict: String(review.verdict),
                summary: review.summary,
            }));
        }
        else if (data.ownerManagement.reviews.length > 0) {
            await this.appendBoardReviews({
                saveId: save.id,
                season: save.season,
                reviews: data.ownerManagement.reviews,
            });
        }
        if (careerRow) {
            const meta = (careerRow.metadata ?? {});
            data.managerCareer = {
                yearsManaged: Number(careerRow.yearsManaged ?? data.managerCareer?.yearsManaged ?? 1),
                playoffAppearances: Number(careerRow.playoffAppearances ?? data.managerCareer?.playoffAppearances ?? 0),
                championships: Number(careerRow.championships ?? data.managerCareer?.championships ?? 0),
                totalWins: Number(meta.totalWins ?? data.managerCareer?.totalWins ?? 0),
                totalLosses: Number(meta.totalLosses ?? data.managerCareer?.totalLosses ?? 0),
                awards: Array.isArray(meta.awards)
                    ? meta.awards.map((value) => String(value))
                    : (data.managerCareer?.awards ?? []),
                milestones: Array.isArray(meta.milestones)
                    ? meta.milestones
                    : (data.managerCareer?.milestones ?? []),
            };
        }
        else {
            await this.upsertManagerCareerSnapshot({
                saveId: save.id,
                season: save.season,
                wins: 0,
                losses: 0,
                managerCareer: data.managerCareer,
            });
        }
        const awardTitles = awardRows.map((award) => award.title);
        data.managerCareer.awards = [...new Set([...(data.managerCareer.awards ?? []), ...awardTitles])];
        if (!data.ownerManagement.lastMonthlyBoardKey) {
            const monthlyEvent = [...data.ownerManagement.history]
                .reverse()
                .find((event) => event.source === "monthly");
            data.ownerManagement.lastMonthlyBoardKey = monthlyEvent?.date?.slice(0, 7) ?? currentDate.slice(0, 7);
        }
        if (!data.ownerManagement.lastMidSeasonReviewWeek) {
            const midSeason = [...data.ownerManagement.reviews]
                .reverse()
                .find((review) => review.title.toLowerCase().includes("mid-season"));
            if (midSeason?.date) {
                data.ownerManagement.lastMidSeasonReviewWeek = (0, gameweekCalendar_1.getGameweekForDate)(save.season, midSeason.date);
            }
        }
        if (!data.ownerManagement.lastSeasonReviewSeason) {
            const seasonReview = [...data.ownerManagement.reviews]
                .reverse()
                .find((review) => review.title.toLowerCase().includes("end-of-season"));
            if (seasonReview?.date) {
                data.ownerManagement.lastSeasonReviewSeason = save.season;
            }
        }
        data.ownerManagement.history = (data.ownerManagement.history ?? []).slice(-160);
        data.ownerManagement.reviews = (data.ownerManagement.reviews ?? []).slice(-24);
        data.ownerManagement.jobSecurity = this.clamp(Math.round(data.ownerManagement.jobSecurity ?? 66), 0, 100);
    }
    async evaluateOwnerGoalsProgress(params) {
        const managedTeamId = params.save.managedTeamId ?? params.save.teamId ?? null;
        if (!managedTeamId) {
            return {
                goalScore: 50,
                managedStanding: null,
                managedConferenceRows: [],
                managedRank: null,
                payroll: 0,
                avgMorale: 65,
                seasonComplete: false,
            };
        }
        const standings = await this.buildConferenceStandings(params.save.id);
        const allRows = [...standings.east, ...standings.west];
        const managedStanding = allRows.find((row) => row.teamId === managedTeamId) ?? null;
        const managedConferenceRows = managedStanding
            ? managedStanding.conference === "East" ? standings.east : standings.west
            : [];
        const managedRank = managedStanding
            ? (managedConferenceRows.findIndex((row) => row.teamId === managedStanding.teamId) + 1)
            : null;
        const completedManagedGames = await prisma_1.default.game.count({
            where: {
                saveId: params.save.id,
                status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                OR: [{ homeTeamId: managedTeamId }, { awayTeamId: managedTeamId }],
            },
        });
        const seasonComplete = completedManagedGames >= 82;
        const payrollAgg = await prisma_1.default.player.aggregate({
            where: { teamId: managedTeamId, active: true },
            _sum: { salary: true },
        });
        const moraleAgg = await prisma_1.default.player.aggregate({
            where: { teamId: managedTeamId, active: true },
            _avg: { morale: true },
        });
        const payroll = Number(payrollAgg._sum.salary ?? 0);
        const avgMorale = Number(moraleAgg._avg.morale ?? 65);
        const goals = params.data.ownerManagement?.goals ?? [];
        for (const goal of goals) {
            if (goal.type === "win_target") {
                const target = Math.max(1, Number(goal.targetNumber ?? 45));
                const wins = Number(managedStanding?.wins ?? 0);
                const losses = Number(managedStanding?.losses ?? 0);
                const games = wins + losses;
                const projectedWins = games > 0 ? (wins / games) * 82 : target * 0.5;
                const progress = this.clamp(projectedWins / target, 0, 1);
                goal.current = wins;
                goal.progress = Number(progress.toFixed(3));
                if (wins >= target)
                    goal.status = "completed";
                else if (seasonComplete)
                    goal.status = "failed";
                else
                    goal.status = projectedWins >= target * 0.95 ? "on_track" : "at_risk";
            }
            if (goal.type === "playoff_goal") {
                const targetText = String(goal.targetText ?? "make_playoffs");
                const threshold = targetText === "conference_finals" ? 4 : targetText === "win_round_1" ? 6 : 10;
                const rank = Number(managedRank ?? 15);
                const progress = this.clamp((threshold + 1 - rank) / threshold, 0, 1);
                goal.current = rank;
                goal.progress = Number(progress.toFixed(3));
                if (rank <= threshold && seasonComplete)
                    goal.status = "completed";
                else if (seasonComplete)
                    goal.status = "failed";
                else if (rank <= threshold)
                    goal.status = "on_track";
                else
                    goal.status = rank <= threshold + 2 ? "at_risk" : "failed";
            }
            if (goal.type === "development") {
                const meta = (goal.meta ?? {});
                const playerIds = Array.isArray(meta.playerIds)
                    ? meta.playerIds.map(Number).filter(Number.isFinite)
                    : [];
                const baselineOveralls = (meta.baselineOveralls ?? {}) ?? {};
                const baselineForms = (meta.baselineForms ?? {}) ?? {};
                const overallDeltaTarget = Number(meta.overallDeltaTarget ?? 2);
                const formDeltaTarget = Number(meta.formDeltaTarget ?? 8);
                const target = Math.max(1, Number(goal.targetNumber ?? Math.max(1, playerIds.length || 2)));
                const players = playerIds.length > 0
                    ? await prisma_1.default.player.findMany({
                        where: { id: { in: playerIds } },
                        select: { id: true, overallCurrent: true, overall: true, form: true },
                    })
                    : [];
                let improved = 0;
                for (const player of players) {
                    const key = String(player.id);
                    const baseOverall = Number(baselineOveralls[key] ?? player.overall ?? player.overallCurrent ?? 70);
                    const baseForm = Number(baselineForms[key] ?? 60);
                    const currentOverall = Number(player.overallCurrent ?? player.overall ?? 70);
                    const currentForm = Number(player.form ?? 60);
                    const improvedOverall = (currentOverall - baseOverall) >= overallDeltaTarget;
                    const improvedForm = (currentForm - baseForm) >= formDeltaTarget;
                    if (improvedOverall || improvedForm)
                        improved += 1;
                }
                goal.current = improved;
                goal.progress = Number(this.clamp(improved / target, 0, 1).toFixed(3));
                if (improved >= target)
                    goal.status = "completed";
                else if (seasonComplete)
                    goal.status = "failed";
                else
                    goal.status = improved > 0 ? "on_track" : "at_risk";
            }
            if (goal.type === "financial") {
                const targetTaxLine = Math.max(120000000, Number(goal.targetNumber ?? 185000000));
                goal.current = payroll;
                const progress = payroll <= targetTaxLine
                    ? 1
                    : this.clamp(1 - ((payroll - targetTaxLine) / (targetTaxLine * 0.35)), 0, 1);
                goal.progress = Number(progress.toFixed(3));
                if (payroll <= targetTaxLine && seasonComplete)
                    goal.status = "completed";
                else if (seasonComplete && payroll > targetTaxLine)
                    goal.status = "failed";
                else
                    goal.status = payroll <= targetTaxLine * 1.05 ? "on_track" : "at_risk";
            }
        }
        const totalWeight = goals.reduce((sum, goal) => sum + Number(goal.weight ?? 0.25), 0) || 1;
        const weightedProgress = goals.reduce((sum, goal) => sum + Number(goal.progress ?? 0) * Number(goal.weight ?? 0.25), 0);
        const goalScore = this.clamp(Math.round((weightedProgress / totalWeight) * 100), 0, 100);
        return {
            goalScore,
            managedStanding,
            managedConferenceRows,
            managedRank,
            payroll,
            avgMorale,
            seasonComplete,
        };
    }
    async runOwnerManagementLoop(params) {
        const managedTeamId = params.save.managedTeamId ?? params.save.teamId ?? null;
        if (!managedTeamId)
            return;
        const evaluation = await this.evaluateOwnerGoalsProgress({
            save: params.save,
            data: params.data,
            date: params.date,
        });
        params.data.ownerManagement = params.data.ownerManagement ?? {};
        params.data.ownerManagement.history = params.data.ownerManagement.history ?? [];
        params.data.ownerManagement.reviews = params.data.ownerManagement.reviews ?? [];
        let jobSecurity = this.clamp(Math.round(params.data.ownerManagement.jobSecurity ?? 66), 0, 100);
        const newHistoryEvents = [];
        const newBoardReviews = [];
        const pushHistory = (entry) => {
            params.data.ownerManagement?.history?.push(entry);
            newHistoryEvents.push(entry);
        };
        const pushReview = (review) => {
            params.data.ownerManagement?.reviews?.push(review);
            newBoardReviews.push(review);
        };
        const todayKey = params.date.toISOString().slice(0, 10);
        let monthEvaluationTriggered = false;
        if (params.rolledWeek) {
            const [l10Wins = 5, l10Losses = 5] = String(evaluation.managedStanding?.l10 ?? "5-5")
                .split("-")
                .map((value) => Number(value) || 0);
            const winTrendDelta = this.clamp((l10Wins - l10Losses) * 0.6, -4.5, 4.5);
            const goalDelta = this.clamp((evaluation.goalScore - 60) / 12, -3, 3);
            const moraleDelta = this.clamp((evaluation.avgMorale - 65) / 20, -2, 2);
            const weekAgo = new Date(params.date.getTime() - (7 * 86400000));
            const recentTransactions = await prisma_1.default.transactionHistory.findMany({
                where: {
                    saveId: params.save.id,
                    teamId: managedTeamId,
                    createdAt: { gte: weekAgo },
                },
                select: { status: true },
            });
            const positiveMoves = recentTransactions.filter((item) => String(item.status || "").toUpperCase() === "COMPLETED").length;
            const negativeMoves = recentTransactions.filter((item) => String(item.status || "").toUpperCase() !== "COMPLETED").length;
            const bigMovesDelta = this.clamp((positiveMoves * 0.8) - (negativeMoves * 0.7), -2.5, 2.5);
            const delta = Math.round(winTrendDelta + goalDelta + moraleDelta + bigMovesDelta);
            if (delta !== 0) {
                jobSecurity = this.clamp(jobSecurity + delta, 0, 100);
                pushHistory({
                    date: todayKey,
                    score: jobSecurity,
                    delta,
                    reason: `Weekly review: form (${l10Wins}-${l10Losses}), goals ${evaluation.goalScore}%, morale ${Math.round(evaluation.avgMorale)}.`,
                    source: "weekly",
                });
            }
        }
        const monthKey = params.date.toISOString().slice(0, 7);
        if (params.data.ownerManagement.lastMonthlyBoardKey !== monthKey) {
            monthEvaluationTriggered = true;
            const topRiskGoal = (params.data.ownerManagement.goals ?? [])
                .find((goal) => goal.status === "at_risk" || goal.status === "failed");
            await this.createInboxMessage({
                saveId: params.save.id,
                date: params.date,
                type: "board",
                title: "Monthly Board Evaluation",
                body: topRiskGoal
                    ? `Current job security: ${jobSecurity} (${this.getJobSecurityBand(jobSecurity)}). Priority concern: ${topRiskGoal.title}.`
                    : `Current job security: ${jobSecurity} (${this.getJobSecurityBand(jobSecurity)}). Keep the current trajectory.`,
                fromName: "Board",
            });
            params.data.ownerManagement.lastMonthlyBoardKey = monthKey;
            pushHistory({
                date: todayKey,
                score: jobSecurity,
                delta: 0,
                reason: "Monthly board evaluation issued.",
                source: "monthly",
            });
        }
        const currentWeek = Number(params.data.week ?? (0, gameweekCalendar_1.getGameweekForDate)(params.save.season, params.date.toISOString().slice(0, 10)));
        if (currentWeek >= 12 && !params.data.ownerManagement.lastMidSeasonReviewWeek) {
            const verdict = jobSecurity >= 78
                ? "renewed"
                : jobSecurity >= 60
                    ? "warning"
                    : jobSecurity >= 45
                        ? "hot_seat"
                        : "fired";
            await this.createInboxMessage({
                saveId: params.save.id,
                date: params.date,
                type: "board",
                title: "Mid-Season Board Checkpoint",
                body: `Mid-season review: ${this.getJobSecurityBand(jobSecurity)}. Goal score ${evaluation.goalScore}%. Verdict: ${verdict.toUpperCase()}.`,
                fromName: "Board",
            });
            pushReview({
                date: todayKey,
                title: "Mid-Season Checkpoint",
                verdict,
                summary: `Job security ${jobSecurity}. Goals at ${evaluation.goalScore}% completion.`,
            });
            params.data.ownerManagement.lastMidSeasonReviewWeek = currentWeek;
            pushHistory({
                date: todayKey,
                score: jobSecurity,
                delta: 0,
                reason: "Mid-season board checkpoint completed.",
                source: "mid_season",
            });
        }
        if (evaluation.seasonComplete && params.data.ownerManagement.lastSeasonReviewSeason !== params.save.season) {
            const verdict = evaluation.goalScore >= 78 && jobSecurity >= 70
                ? "renewed"
                : evaluation.goalScore >= 60 && jobSecurity >= 55
                    ? "warning"
                    : evaluation.goalScore >= 45
                        ? "hot_seat"
                        : "fired";
            const finalSummary = `Season review: ${evaluation.managedStanding?.wins ?? 0}-${evaluation.managedStanding?.losses ?? 0}, goals ${evaluation.goalScore}%, verdict ${verdict.toUpperCase()}.`;
            await this.createInboxMessage({
                saveId: params.save.id,
                date: params.date,
                type: "board",
                title: "End-of-Season Board Review",
                body: finalSummary,
                fromName: "Board",
            });
            pushReview({
                date: todayKey,
                title: "End-of-Season Review",
                verdict,
                summary: finalSummary,
            });
            params.data.ownerManagement.lastSeasonReviewSeason = params.save.season;
            const seasonDelta = verdict === "renewed" ? 3 : verdict === "fired" ? -10 : -2;
            jobSecurity = this.clamp(jobSecurity + seasonDelta, 0, 100);
            pushHistory({
                date: todayKey,
                score: jobSecurity,
                delta: seasonDelta,
                reason: `End-of-season verdict: ${verdict}.`,
                source: "season_review",
            });
            params.data.managerCareer = params.data.managerCareer ?? {};
            params.data.managerCareer.totalWins = Number(params.data.managerCareer.totalWins ?? 0) + Number(evaluation.managedStanding?.wins ?? 0);
            params.data.managerCareer.totalLosses = Number(params.data.managerCareer.totalLosses ?? 0) + Number(evaluation.managedStanding?.losses ?? 0);
            params.data.managerCareer.playoffAppearances = Number(params.data.managerCareer.playoffAppearances ?? 0) + ((evaluation.managedRank ?? 99) <= 10 ? 1 : 0);
            if (verdict !== "fired") {
                params.data.managerCareer.yearsManaged = Number(params.data.managerCareer.yearsManaged ?? 1) + 1;
            }
            params.data.managerCareer.milestones = params.data.managerCareer.milestones ?? [];
            params.data.managerCareer.milestones.push({
                date: todayKey,
                title: "Season Review Completed",
                detail: finalSummary,
                type: "season_review",
            });
            if (verdict === "fired") {
                jobSecurity = this.clamp(Math.min(jobSecurity, 30), 0, 100);
            }
            const seasonAwards = [];
            if ((evaluation.managedStanding?.wins ?? 0) >= 50) {
                seasonAwards.push({
                    awardType: "wins",
                    title: "50-Win Club",
                    description: `Finished the season with ${evaluation.managedStanding?.wins ?? 0} wins.`,
                });
            }
            if ((evaluation.managedRank ?? 99) <= 3) {
                seasonAwards.push({
                    awardType: "seeding",
                    title: "Top 3 Seed",
                    description: `Secured conference seed #${evaluation.managedRank}.`,
                });
            }
            if (evaluation.goalScore >= 85) {
                seasonAwards.push({
                    awardType: "board",
                    title: "Board Favorite",
                    description: `Ended the season with ${evaluation.goalScore}% owner-goal completion.`,
                });
            }
            if (seasonAwards.length > 0) {
                await this.upsertManagerAwards({
                    saveId: params.save.id,
                    season: params.save.season,
                    awards: seasonAwards,
                });
                params.data.managerCareer.awards = [
                    ...new Set([...(params.data.managerCareer.awards ?? []), ...seasonAwards.map((award) => award.title)]),
                ];
            }
        }
        params.data.ownerManagement.history = (params.data.ownerManagement.history ?? []).slice(-160);
        params.data.ownerManagement.reviews = (params.data.ownerManagement.reviews ?? []).slice(-24);
        params.data.ownerManagement.jobSecurity = this.clamp(Math.round(jobSecurity), 0, 100);
        await this.upsertOwnerGoals({
            saveId: params.save.id,
            season: params.save.season,
            goals: params.data.ownerManagement.goals ?? [],
        });
        await this.appendJobSecurityEvents({
            saveId: params.save.id,
            events: newHistoryEvents,
        });
        await this.appendBoardReviews({
            saveId: params.save.id,
            season: params.save.season,
            reviews: newBoardReviews,
        });
        params.data.managerCareer = params.data.managerCareer ?? {
            yearsManaged: 1,
            playoffAppearances: 0,
            championships: 0,
            totalWins: 0,
            totalLosses: 0,
            awards: [],
            milestones: [],
        };
        await this.upsertManagerCareerSnapshot({
            saveId: params.save.id,
            season: params.save.season,
            wins: Number(evaluation.managedStanding?.wins ?? 0),
            losses: Number(evaluation.managedStanding?.losses ?? 0),
            managerCareer: params.data.managerCareer,
        });
        if (params.rolledWeek) {
            const snapshotWeek = Math.max(1, Number(params.data.week ?? 1) - 1);
            await this.persistWeeklyStandingsSnapshot({
                saveId: params.save.id,
                season: params.save.season,
                week: snapshotWeek,
            });
            const integrity = await this.runSaveIntegrityChecks(params.save.id);
            if (!integrity.ok) {
                await this.createInboxMessage({
                    saveId: params.save.id,
                    date: params.date,
                    type: "staff",
                    title: "Data Integrity Warning",
                    body: `Integrity check flagged ${integrity.mismatches.length} team(s) with games-played mismatch. Please run maintenance checks.`,
                    fromName: "Analytics Ops",
                });
            }
        }
        if (monthEvaluationTriggered) {
            await this.persistMonthlyTeamMetricsSnapshot({
                saveId: params.save.id,
                season: params.save.season,
                monthKey,
            });
        }
    }
    getJobSecurityBand(score) {
        if (score >= 85)
            return "Very Secure";
        if (score >= 65)
            return "Stable";
        if (score >= 45)
            return "Under Review";
        return "Hot Seat";
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
                status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
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
        const intensityToScore = (v) => (v === "high" ? 80 : v === "low" ? 35 : 60);
        const percentToTier = (percent) => {
            if (percent <= 45)
                return "low";
            if (percent >= 75)
                return "high";
            return "balanced";
        };
        const resolvePercent = (value, explicitPercent, fallbackPercent) => {
            const p1 = Number(explicitPercent);
            if (Number.isFinite(p1))
                return this.clamp(Math.round(p1), 20, 100);
            const p2 = Number(value);
            if (Number.isFinite(p2))
                return this.clamp(Math.round(p2), 20, 100);
            const mapped = this.fromStoredIntensity(typeof value === "string" ? value : undefined);
            return mapped ? intensityToScore(mapped) : this.clamp(Math.round(fallbackPercent), 20, 100);
        };
        const teamPercent = resolvePercent(dayPlan.intensity, dayPlan.intensityPercent, 60);
        const teamTier = percentToTier(teamPercent);
        for (const key of Object.keys(data.playerState)) {
            const prev = data.playerState[key];
            const persisted = persistedPlans?.get(Number(key));
            const personal = data.training.playerPlans[key];
            const personalDay = personal?.dayPlan?.[dayKey];
            const persistedTier = this.fromStoredIntensity(persisted?.intensity) ?? teamTier;
            const intensityPercent = resolvePercent(personalDay?.intensity ?? personal?.intensity, personalDay?.intensityPercent ?? personal?.intensityPercent, intensityToScore(persistedTier));
            const intensity = percentToTier(intensityPercent);
            const focus = personalDay?.focus ?? personal?.focus ?? this.fromStoredFocus(persisted?.focus) ?? dayPlan.focus;
            const durationMinutes = Math.max(30, Math.min(180, Number(personalDay?.durationMinutes ?? dayPlan.durationMinutes ?? 90) || 90));
            if (persisted)
                appliedPlanCount += 1;
            const injuryPenalty = this.isPlayerInjured(data, key) ? 0.4 : 1;
            const loadScore = intensityPercent;
            const durationFactor = durationMinutes / 90;
            const trainFactor = (loadScore / 100) * durationFactor * injuryPenalty;
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
            const carry = {
                offense: prev.trainingCarry?.offense ?? 0,
                defense: prev.trainingCarry?.defense ?? 0,
                physical: prev.trainingCarry?.physical ?? 0,
                iq: prev.trainingCarry?.iq ?? 0,
                stamina: prev.trainingCarry?.stamina ?? 0,
                health: prev.trainingCarry?.health ?? 0,
                morale: prev.trainingCarry?.morale ?? 0,
            };
            if (focus === "shooting") {
                carry.offense += 0.22 * trainFactor;
            }
            else if (focus === "defense") {
                carry.defense += 0.22 * trainFactor;
            }
            else if (focus === "fitness") {
                carry.physical += 0.26 * trainFactor;
                carry.stamina += 0.20 * trainFactor;
                carry.health += 0.10 * (intensity === "low" ? 1 : 0);
            }
            else if (focus === "playmaking") {
                carry.iq += 0.20 * trainFactor;
                carry.offense += 0.10 * trainFactor;
            }
            else {
                carry.offense += 0.08 * trainFactor;
                carry.defense += 0.08 * trainFactor;
                carry.iq += 0.08 * trainFactor;
            }
            carry.morale += intensity === "high" ? -0.05 : intensity === "low" ? 0.08 : 0.03;
            data.playerState[key] = {
                ...prev,
                fatigue: this.clamp(Math.round(prev.fatigue + fatigueDelta - recoveryBonus), 0, 100),
                form: this.clamp(Math.round(prev.form + formDelta), 0, 100),
                morale: this.clamp(Math.round(prev.morale + (formDelta > 0.7 ? 0.7 : formDelta > 0 ? 0.3 : -0.2)), 0, 100),
                trainingCarry: carry,
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
            let nextOff = this.clamp(Math.round(player.offensiveRating ?? baseOverall), 40, 99);
            let nextDef = this.clamp(Math.round(player.defensiveRating ?? baseOverall), 40, 99);
            let nextPhy = this.clamp(Math.round(player.physicalRating ?? baseOverall), 40, 99);
            let nextIq = this.clamp(Math.round(player.iqRating ?? baseOverall), 40, 99);
            const carry = {
                offense: state.trainingCarry?.offense ?? 0,
                defense: state.trainingCarry?.defense ?? 0,
                physical: state.trainingCarry?.physical ?? 0,
                iq: state.trainingCarry?.iq ?? 0,
                stamina: state.trainingCarry?.stamina ?? 0,
                health: state.trainingCarry?.health ?? 0,
                morale: state.trainingCarry?.morale ?? 0,
            };
            const consumeCarry = (key) => {
                let steps = 0;
                while (Math.abs(carry[key]) >= 1) {
                    steps += carry[key] > 0 ? 1 : -1;
                    carry[key] += carry[key] > 0 ? -1 : 1;
                }
                return steps;
            };
            nextOff = this.clamp(nextOff + consumeCarry("offense"), 40, 99);
            nextDef = this.clamp(nextDef + consumeCarry("defense"), 40, 99);
            nextPhy = this.clamp(nextPhy + consumeCarry("physical"), 40, 99);
            nextIq = this.clamp(nextIq + consumeCarry("iq"), 40, 99);
            const nextBaseOverall = this.clamp(Math.round((nextOff + nextDef + nextPhy + nextIq) / 4), 40, 99);
            let formTrendDays = player.formTrendDays ?? 0;
            const form = this.clamp(Math.round(state.form ?? player.form ?? 70), 0, 100);
            const morale = this.clamp(Math.round((state.morale ?? player.morale ?? 50) + carry.morale), 0, 100);
            const fatigue = this.clamp(Math.round((state.fatigue ?? player.fatigue ?? 10) - carry.stamina - carry.health), 0, 100);
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
            const lower = Math.max(40, nextBaseOverall - 8);
            const upper = Math.min(99, nextBaseOverall + 8);
            overallCurrent = this.clamp(Math.round(nextBaseOverall
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
            state.trainingCarry = carry;
            const prevAttrs = (player.attributes && typeof player.attributes === "object")
                ? player.attributes
                : {};
            const nextAttrs = {
                ...prevAttrs,
                shooting3: this.clamp(Math.round(Number(prevAttrs.shooting3 ?? nextOff) + (nextOff - (player.offensiveRating ?? nextOff)) * 0.6), 40, 99),
                shootingMid: this.clamp(Math.round(Number(prevAttrs.shootingMid ?? nextOff) + (nextOff - (player.offensiveRating ?? nextOff)) * 0.5), 40, 99),
                shooting: this.clamp(Math.round(Number(prevAttrs.shooting ?? nextOff) + (nextOff - (player.offensiveRating ?? nextOff)) * 0.55), 40, 99),
                playmaking: this.clamp(Math.round(Number(prevAttrs.playmaking ?? nextIq) + (nextIq - (player.iqRating ?? nextIq)) * 0.7), 40, 99),
                play: this.clamp(Math.round(Number(prevAttrs.play ?? nextIq) + (nextIq - (player.iqRating ?? nextIq)) * 0.7), 40, 99),
                defense: this.clamp(Math.round(Number(prevAttrs.defense ?? nextDef) + (nextDef - (player.defensiveRating ?? nextDef)) * 0.8), 40, 99),
                def: this.clamp(Math.round(Number(prevAttrs.def ?? nextDef) + (nextDef - (player.defensiveRating ?? nextDef)) * 0.8), 40, 99),
                athleticism: this.clamp(Math.round(Number(prevAttrs.athleticism ?? nextPhy) + (nextPhy - (player.physicalRating ?? nextPhy)) * 0.8), 40, 99),
                phy: this.clamp(Math.round(Number(prevAttrs.phy ?? nextPhy) + (nextPhy - (player.physicalRating ?? nextPhy)) * 0.8), 40, 99),
                iq: this.clamp(Math.round(Number(prevAttrs.iq ?? nextIq) + (nextIq - (player.iqRating ?? nextIq)) * 0.7), 40, 99),
                att: this.clamp(Math.round(Number(prevAttrs.att ?? nextOff) + (nextOff - (player.offensiveRating ?? nextOff)) * 0.7), 40, 99),
            };
            updates.push(prisma_1.default.player.update({
                where: { id: playerId },
                data: {
                    form,
                    morale,
                    fatigue,
                    offensiveRating: nextOff,
                    defensiveRating: nextDef,
                    physicalRating: nextPhy,
                    iqRating: nextIq,
                    overallBase: nextBaseOverall,
                    overallCurrent,
                    overall: overallCurrent,
                    attributes: nextAttrs,
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
        const save = await prisma_1.default.save.findFirst({ where: { id: saveId, deletedAt: null }, select: { teamId: true } });
        const starters = save?.teamId
            ? await prisma_1.default.player.findMany({
                where: { teamId: save.teamId, active: true },
                select: { name: true },
                orderBy: [{ overallCurrent: "desc" }, { overall: "desc" }],
                take: 3,
            })
            : [];
        const playerName = starters[0]?.name ?? "Team Captain";
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
                {
                    saveId,
                    date: new Date(baseDate.getTime() + 1000 * 60 * 30),
                    type: "player",
                    title: "Playing Time Conversation",
                    body: "Coach, am I doing enough to keep my current role? I want to know where I stand.",
                    fromName: playerName,
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
        const save = await prisma_1.default.save.findFirst({
            where: { id: saveId, deletedAt: null },
            select: { teamId: true },
        });
        const roster = save?.teamId
            ? await prisma_1.default.player.findMany({
                where: { teamId: save.teamId, active: true },
                select: { id: true, name: true, age: true, position: true, overallCurrent: true, overall: true },
                orderBy: [{ overallCurrent: "desc" }, { overall: "desc" }],
                take: 12,
            })
            : [];
        const youngTargets = await prisma_1.default.player.findMany({
            where: {
                active: true,
                ...(save?.teamId ? { teamId: { not: save.teamId } } : {}),
                age: { lte: 24 },
            },
            select: { name: true, age: true, position: true, overallCurrent: true, overall: true },
            orderBy: [{ potential: "desc" }, { overallCurrent: "desc" }],
            take: 12,
        });
        const randomRosterPlayer = roster.length > 0 ? roster[Math.floor(Math.random() * roster.length)] : null;
        const randomYoung = youngTargets.length > 0 ? youngTargets[Math.floor(Math.random() * youngTargets.length)] : null;
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
            ...(randomYoung ? [{
                    type: "scouting",
                    title: "Young Talent Recommendation",
                    body: `Scout recommendation: ${randomYoung.name} (${randomYoung.position}, ${randomYoung.age} y/o) could be a long-term fit. Consider shortlisting.`,
                    fromName: "Head Scout",
                }] : []),
            ...(randomRosterPlayer ? [{
                    type: "player",
                    title: "Locker Room Message",
                    body: "Coach, are you happy with my recent performance? I want your honest feedback.",
                    fromName: randomRosterPlayer.name,
                }] : []),
            ...(randomRosterPlayer ? [{
                    type: "staff",
                    title: "Trade Opportunity",
                    body: `General manager update: we have incoming interest around ${randomRosterPlayer.name}. Do you want us to explore it?`,
                    fromName: "General Manager",
                }] : []),
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
    async generateScheduleForSave(saveId, season) {
        const gamesCount = await prisma_1.default.game.count({
            where: { saveId },
        });
        if (gamesCount > 0)
            return;
        const teams = await prisma_1.default.team.findMany({
            orderBy: { id: "asc" },
            select: { id: true, shortName: true, name: true },
        });
        if (teams.length < 2)
            return;
        const { fixtures, report } = (0, fixtureCsvLoader_1.loadFixturesFromCsv)({ season, teams });
        if (report.unmappedTeams.length > 0) {
            throw new AppError_1.BadRequestError(`fixtures.csv contains unmapped team names: ${report.unmappedTeams.join(", ")}`);
        }
        if (fixtures.length === 0) {
            throw new AppError_1.BadRequestError("fixtures.csv did not produce any schedule rows for this season.");
        }
        if (report.duplicateRows > 0) {
            throw new AppError_1.BadRequestError(`fixtures.csv has ${report.duplicateRows} duplicate fixture rows.`);
        }
        await prisma_1.default.game.createMany({
            data: fixtures.map((game) => ({
                saveId,
                homeTeamId: game.homeTeamId,
                awayTeamId: game.awayTeamId,
                gameDate: game.gameDate,
                status: game.status,
                homeScore: game.homeScore,
                awayScore: game.awayScore,
            })),
        });
        if (report.skippedRows > 0) {
            console.warn(`[fixtures.csv] loaded with ${report.skippedRows} skipped rows`);
        }
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
        home.offenseRating = this.clamp(Math.round(home.offenseRating * 0.96 + homeScore * 0.04), 60, 130);
        away.offenseRating = this.clamp(Math.round(away.offenseRating * 0.96 + awayScore * 0.04), 60, 130);
        home.defenseRating = this.clamp(Math.round(home.defenseRating * 0.96 + awayScore * 0.04), 60, 130);
        away.defenseRating = this.clamp(Math.round(away.defenseRating * 0.96 + homeScore * 0.04), 60, 130);
    }
    estimateTeamStrength(teamState) {
        const offense = teamState.offenseRating ?? 85;
        const defense = teamState.defenseRating ?? 85;
        const defenseQuality = 130 - defense; // lower allowed score -> better defense
        return (offense * 0.55) + (defenseQuality * 0.45) + (teamState.form - 50) * 0.08;
    }
    computeTeamFormAfterGame(params) {
        const K = 14;
        const x = (params.teamStrength - params.oppStrength) / K;
        const expectedWinProb = 1 / (1 + Math.exp(-x));
        const delta = (params.result - expectedWinProb) * 3.5;
        const streakBonus = this.clamp(params.streak, -5, 5) * 0.2;
        const marginAdj = this.clamp(params.pointDiff, -15, 15) * 0.04;
        const meanRevert = (50 - params.teamForm) * 0.03;
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
    async applyGameweekPerformanceAdjustments(params) {
        const ranges = (0, gameweekCalendar_1.getGameweekRanges)(params.season);
        const range = ranges.find((r) => r.week === params.completedWeek);
        if (!range)
            return;
        const weekStart = new Date(`${range.start}T00:00:00.000Z`);
        const weekEnd = new Date(`${range.end}T23:59:59.999Z`);
        const weekRows = await prisma_1.default.gameStat.findMany({
            where: {
                game: {
                    saveId: params.saveId,
                    status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                    gameDate: { gte: weekStart, lte: weekEnd },
                },
            },
            select: {
                playerId: true,
                gameId: true,
                minutes: true,
                performanceRating: true,
                points: true,
                rebounds: true,
                assists: true,
                teamId: true,
            },
        });
        if (weekRows.length === 0)
            return;
        const playerIds = [...new Set(weekRows.map((r) => r.playerId))];
        const players = await prisma_1.default.player.findMany({
            where: { id: { in: playerIds }, active: true },
            select: {
                id: true,
                name: true,
                teamId: true,
                age: true,
                overallBase: true,
                overallCurrent: true,
                overall: true,
                potential: true,
                morale: true,
            },
        });
        const playerById = new Map(players.map((p) => [p.id, p]));
        const prevRows = await prisma_1.default.gameStat.findMany({
            where: {
                playerId: { in: playerIds },
                game: {
                    saveId: params.saveId,
                    status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                    gameDate: { lt: weekStart },
                },
            },
            orderBy: { game: { gameDate: "desc" } },
            select: {
                playerId: true,
                performanceRating: true,
            },
        });
        const prevScoresByPlayer = new Map();
        for (const row of prevRows) {
            const arr = prevScoresByPlayer.get(row.playerId) ?? [];
            if (arr.length < 6)
                arr.push(Number(row.performanceRating ?? 50));
            prevScoresByPlayer.set(row.playerId, arr);
        }
        const weekByPlayer = new Map();
        for (const row of weekRows) {
            const arr = weekByPlayer.get(row.playerId) ?? [];
            arr.push(row);
            weekByPlayer.set(row.playerId, arr);
        }
        params.currentData.playerState = params.currentData.playerState ?? {};
        const pendingUpdates = new Map();
        const complaintCandidates = [];
        for (const [playerId, rows] of weekByPlayer.entries()) {
            const player = playerById.get(playerId);
            if (!player)
                continue;
            const currentOverall = Number(player.overallCurrent ?? player.overall ?? 60);
            const baseOverall = Number(player.overallBase ?? player.overall ?? currentOverall);
            const potential = Number(player.potential ?? 75);
            const age = Number(player.age ?? 27);
            const key = String(playerId);
            const state = params.currentData.playerState[key] ?? { fatigue: 10, morale: 65, form: 60 };
            const weekAvgPerf = rows.reduce((sum, r) => sum + Number(r.performanceRating ?? 50), 0) / Math.max(1, rows.length);
            const prevScores = prevScoresByPlayer.get(playerId) ?? [];
            const baselinePerf = prevScores.length > 0
                ? prevScores.reduce((sum, v) => sum + v, 0) / prevScores.length
                : Number(state.form ?? 60);
            let delta = 0;
            const perfDiff = weekAvgPerf - baselinePerf;
            if (perfDiff >= 6)
                delta = 1;
            else if (perfDiff <= -6)
                delta = -1;
            const lower = Math.max(40, baseOverall - 8, age >= 35 ? 52 : 45);
            const upper = Math.min(99, potential + (age <= 24 ? 2 : 0));
            const nextOverall = this.clamp(currentOverall + delta, lower, upper);
            const nextMorale = this.clamp(Math.round(Number(state.morale ?? player.morale ?? 65) + (delta > 0 ? 1 : delta < 0 ? -1 : 0)), 0, 100);
            params.currentData.playerState[key] = {
                ...state,
                morale: nextMorale,
                effectiveOverall: nextOverall,
                form: this.clamp(Math.round((Number(state.form ?? 60) * 0.8) + (weekAvgPerf * 0.2)), 0, 100),
            };
            pendingUpdates.set(playerId, {
                morale: nextMorale,
                overallCurrent: nextOverall,
                overall: nextOverall,
            });
        }
        if (params.managedTeamId) {
            const teamGamesThisWeek = await prisma_1.default.game.count({
                where: {
                    saveId: params.saveId,
                    status: { in: fixtureStatus_1.COMPLETED_GAME_STATUSES },
                    gameDate: { gte: weekStart, lte: weekEnd },
                    OR: [{ homeTeamId: params.managedTeamId }, { awayTeamId: params.managedTeamId }],
                },
            });
            if (teamGamesThisWeek > 0) {
                const managedRoster = await prisma_1.default.player.findMany({
                    where: { active: true, teamId: params.managedTeamId },
                    select: { id: true, name: true, morale: true, overallCurrent: true, overall: true },
                });
                const minutesByPlayer = new Map();
                for (const row of weekRows) {
                    if (row.teamId !== params.managedTeamId)
                        continue;
                    minutesByPlayer.set(row.playerId, (minutesByPlayer.get(row.playerId) ?? 0) + Number(row.minutes ?? 0));
                }
                for (const player of managedRoster) {
                    const key = String(player.id);
                    const state = params.currentData.playerState[key] ?? { fatigue: 10, morale: 65, form: 60 };
                    const avgMinutes = (minutesByPlayer.get(player.id) ?? 0) / teamGamesThisWeek;
                    if (avgMinutes >= 10)
                        continue;
                    const moralePenalty = avgMinutes < 6 ? -3 : -2;
                    const baseMorale = pendingUpdates.get(player.id)?.morale ?? Number(state.morale ?? player.morale ?? 65);
                    const nextMorale = this.clamp(Math.round(baseMorale + moralePenalty), 0, 100);
                    params.currentData.playerState[key] = {
                        ...state,
                        morale: nextMorale,
                    };
                    const currentOverall = pendingUpdates.get(player.id)?.overallCurrent
                        ?? Number(player.overallCurrent ?? player.overall ?? 60);
                    pendingUpdates.set(player.id, {
                        morale: nextMorale,
                        overallCurrent: currentOverall,
                        overall: currentOverall,
                    });
                    complaintCandidates.push({
                        playerId: player.id,
                        playerName: player.name,
                        avgMinutes,
                    });
                }
            }
        }
        const updateOps = [];
        for (const [playerId, payload] of pendingUpdates.entries()) {
            updateOps.push(prisma_1.default.player.update({
                where: { id: playerId },
                data: payload,
            }));
        }
        if (updateOps.length > 0) {
            await prisma_1.default.$transaction(updateOps);
        }
        if (params.managedTeamId && complaintCandidates.length > 0) {
            const toNotify = complaintCandidates
                .sort((a, b) => a.avgMinutes - b.avgMinutes)
                .slice(0, 3);
            for (const item of toNotify) {
                await this.createInboxMessage({
                    saveId: params.saveId,
                    date: weekEnd,
                    type: "player",
                    title: "Playing Time Concern",
                    body: `Coach, I only averaged ${item.avgMinutes.toFixed(1)} minutes this gameweek. Will I get a bigger role?`,
                    fromName: item.playerName,
                });
            }
        }
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
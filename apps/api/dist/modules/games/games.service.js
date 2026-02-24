"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class GamesService {
    async getAllGames() {
        return prisma_1.default.game.findMany({
            include: {
                homeTeam: true,
                awayTeam: true,
                gameStats: true,
            },
            orderBy: { gameDate: "asc" },
        });
    }
    async getGameById(id) {
        return prisma_1.default.game.findUnique({
            where: { id },
            include: {
                homeTeam: true,
                awayTeam: true,
                gameStats: {
                    include: { player: true },
                },
            },
        });
    }
    async getGamesBetweenTeams(homeTeamId, awayTeamId) {
        return prisma_1.default.game.findMany({
            where: {
                OR: [
                    { homeTeamId, awayTeamId },
                    { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
                ],
            },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
        });
    }
    async getUpcomingGames(limit = 10) {
        return prisma_1.default.game.findMany({
            where: { status: "scheduled" },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
            orderBy: { gameDate: "asc" },
            take: limit,
        });
    }
}
exports.GamesService = GamesService;
//# sourceMappingURL=games.service.js.map
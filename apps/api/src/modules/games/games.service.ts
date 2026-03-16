import prisma from "../../config/prisma";
import { UPCOMING_GAME_STATUSES } from "../fixtures/fixtureStatus";

export class GamesService {
  async getAllGames() {
    return prisma.game.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
        gameStats: true,
      },
      orderBy: { gameDate: "asc" },
    });
  }

  async getGameById(id: number) {
    return prisma.game.findUnique({
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

  async getGamesBetweenTeams(homeTeamId: number, awayTeamId: number) {
    return prisma.game.findMany({
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
    return prisma.game.findMany({
      where: { status: { in: UPCOMING_GAME_STATUSES } },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: { gameDate: "asc" },
      take: limit,
    });
  }
}

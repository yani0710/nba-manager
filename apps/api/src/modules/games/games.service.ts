import prisma from "../../config/prisma";

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

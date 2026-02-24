import prisma from "../../config/prisma";
import { enrichPlayersFromSalariesRoster } from "../../data/enrichPlayers";

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

export class PlayersService {
  async getPlayersByTeamId(teamId: number, includeInactive = false, saveId?: number) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, shortName: true } });
    if (!team) return [];
    const salariesRoster = await enrichPlayersFromSalariesRoster();
    const roster = salariesRoster.byTeam.get(team.shortName) ?? [];
    const filtered = includeInactive ? roster : roster;
    return this.attachSaveStateToRoster(filtered, saveId);
  }

  async getPlayerById(id: number, saveId?: number) {
    const player = await prisma.player.findUnique({
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
    if (!player) return null;
    const [withState] = await this.attachSaveState([player], saveId);
    if (!withState) return null;
    return {
      ...withState,
      scouting: this.buildStrengthsWeaknesses(withState.attributes),
    };
  }

  async getAllPlayers(take?: number, includeInactive = false, saveId?: number) {
    const players = await prisma.player.findMany({
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

  async getPlayerStats(playerId: number, saveId?: number) {
    const where = {
      playerId,
      ...(saveId ? { game: { saveId } } : {}),
    };

    const [games, grouped, lastFive] = await Promise.all([
      prisma.gameStat.count({ where }),
      prisma.gameStat.aggregate({
        where,
        _sum: { points: true, rebounds: true, assists: true },
      }),
      prisma.gameStat.findMany({
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

  private async attachSaveState<T extends { id: number; overall: number }>(players: T[], saveId?: number) {
    if (!saveId || players.length === 0) return players;
    const save = await prisma.save.findUnique({
      where: { id: saveId },
      select: { data: true },
    });
    const payload = (save?.data ?? {}) as {
      playerState?: Record<string, { form?: number; fatigue?: number; morale?: number; effectiveOverall?: number }>;
    };
    const playerState = payload.playerState ?? {};
    return players.map((player) => {
      const state = playerState[String(player.id)];
      const currentOverall = state?.effectiveOverall
        ?? (player as { overallCurrent?: number }).overallCurrent
        ?? player.overall;
      return {
        ...player,
        form: state?.form ?? (player as { form?: number }).form ?? 60,
        fatigue: state?.fatigue ?? 10,
        morale: state?.morale ?? 65,
        overall: currentOverall,
        overallCurrent: currentOverall,
        effectiveOverall: currentOverall,
      };
    });
  }

  private async attachSaveStateToRoster<T extends { id: number | null; overall?: number | null; overallCurrent?: number | null; form?: number | null; fatigue?: number | null; morale?: number | null }>(
    players: T[],
    saveId?: number,
  ) {
    if (!saveId || players.length === 0) return players;
    const save = await prisma.save.findUnique({ where: { id: saveId }, select: { data: true } });
    const payload = (save?.data ?? {}) as {
      playerState?: Record<string, { form?: number; fatigue?: number; morale?: number; effectiveOverall?: number }>;
    };
    const playerState = payload.playerState ?? {};
    return players.map((player) => {
      if (!player.id) return player;
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

  private buildStrengthsWeaknesses(attributes: unknown) {
    const attr = (attributes ?? {}) as Record<string, unknown>;
    const candidates: Array<{ key: string; label: string; value: number }> = [];
    const push = (key: string, label: string, value: unknown) => {
      if (typeof value === "number") candidates.push({ key, label, value });
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

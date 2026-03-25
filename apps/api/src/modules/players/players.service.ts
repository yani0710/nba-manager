import prisma from "../../config/prisma";
import { enrichPlayersFromSalariesRoster } from "../../data/enrichPlayers";
import { normalizePlayerName } from "../../data/loadSalariesRoster";
import { resolveDetailedPosition } from "../../data/loadDetailedPositions";

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
    const players = await prisma.player.findMany({
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
    const withOverrides = await this.attachTransferOverridesToPlayers(withState as any[], saveId);
    const withSalary = await this.applySalaryFallbackFromRoster(withOverrides as any[]);
    return this.applyDetailedPositionFallback(withSalary as any[]);
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
    const [withTransferOverride] = await this.attachTransferOverridesToPlayers([withState], saveId);
    const [withSalary] = await this.applySalaryFallbackFromRoster([withTransferOverride ?? withState] as any[]);
    const [withDetailedPosition] = this.applyDetailedPositionFallback([withSalary] as any[]);
    return {
      ...withDetailedPosition,
      scouting: this.buildStrengthsWeaknesses(withDetailedPosition.attributes),
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
    const withState = await this.attachSaveState(players, saveId);
    const withOverrides = await this.attachTransferOverridesToPlayers(withState as any[], saveId);
    const withSalary = await this.applySalaryFallbackFromRoster(withOverrides as any[]);
    return this.applyDetailedPositionFallback(withSalary as any[]);
  }

  private async applySalaryFallbackFromRoster<T extends { id: number; name: string; team?: { shortName?: string | null } | null; salary?: number | null }>(
    players: T[],
  ): Promise<T[]> {
    if (!players || players.length === 0) return players;
    const needsFallback = players.some((p) => !Number.isFinite(Number(p.salary)) || Number(p.salary) <= 0);
    if (!needsFallback) return players;

    const roster = await enrichPlayersFromSalariesRoster();
    const byId = new Map<number, number>();
    const byNameTeam = new Map<string, number>();
    const byName = new Map<string, number>();

    for (const teamRows of roster.byTeam.values()) {
      for (const row of teamRows) {
        const salary = Number(row.salary);
        if (!Number.isFinite(salary) || salary <= 0) continue;
        if (Number.isFinite(Number(row.id))) {
          const id = Number(row.id);
          const prev = byId.get(id) ?? -1;
          if (salary > prev) byId.set(id, salary);
        }
        const key = `${normalizePlayerName(String(row.name ?? row.rosterName ?? ""))}|${String(row.team?.shortName ?? row.rosterTeamCode ?? "").toUpperCase()}`;
        if (key !== "|") {
          const prev = byNameTeam.get(key) ?? -1;
          if (salary > prev) byNameTeam.set(key, salary);
        }
        const nameKey = normalizePlayerName(String(row.name ?? row.rosterName ?? ""));
        if (nameKey) {
          const prev = byName.get(nameKey) ?? -1;
          if (salary > prev) byName.set(nameKey, salary);
        }
      }
    }

    return players.map((player) => {
      const current = Number(player.salary);
      const byIdSalary = byId.get(Number(player.id));
      const key = `${normalizePlayerName(String(player.name ?? ""))}|${String(player.team?.shortName ?? "").toUpperCase()}`;
      const byNameSalary = byNameTeam.get(key);
      const nameOnlySalary = byName.get(normalizePlayerName(String(player.name ?? "")));
      const nextSalary = (Number.isFinite(byIdSalary) && byIdSalary! > 0)
        ? byIdSalary
        : (Number.isFinite(byNameSalary) && byNameSalary! > 0
          ? byNameSalary
          : (Number.isFinite(nameOnlySalary) && nameOnlySalary! > 0 ? nameOnlySalary : current));
      return {
        ...player,
        salary: Number.isFinite(nextSalary) && Number(nextSalary) > 0 ? Number(nextSalary) : (Number.isFinite(current) ? current : null),
      };
    });
  }

  private applyDetailedPositionFallback<T extends {
    name: string;
    team?: { shortName?: string | null } | null;
    position?: string | null;
    primaryPosition?: string | null;
    secondaryPosition?: string | null;
  }>(players: T[]): T[] {
    if (!players || players.length === 0) return players;

    return players.map((player) => {
      const detailed = resolveDetailedPosition(player.name, player.team?.shortName ?? "", player.position ?? null);
      if (!detailed) return player;

      const nextPosition = detailed;
      const nextPrimary = player.primaryPosition && String(player.primaryPosition).trim() !== ""
        ? resolveDetailedPosition(player.name, player.team?.shortName ?? "", player.primaryPosition ?? null) ?? player.primaryPosition
        : detailed;
      return {
        ...player,
        position: nextPosition,
        primaryPosition: nextPrimary,
      };
    });
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

  private async attachTransferOverridesToPlayers<T extends { id: number; teamId?: number | null; team?: { id: number; shortName: string; name?: string; city?: string } | null }>(
    players: T[],
    saveId?: number,
  ) {
    if (!saveId || players.length === 0) return players;
    const [save, teams] = await Promise.all([
      prisma.save.findUnique({ where: { id: saveId }, select: { data: true } }),
      prisma.team.findMany({ select: { id: true, shortName: true, name: true, city: true } }),
    ]);
    const payload = (save?.data ?? {}) as { transferState?: { playerTeamOverrides?: Record<string, number> } };
    const overrides = payload.transferState?.playerTeamOverrides ?? {};
    if (Object.keys(overrides).length === 0) return players;
    const teamById = new Map(teams.map((t) => [t.id, t]));

    return players.map((player) => {
      const overrideTeamId = overrides[String(player.id)];
      if (!overrideTeamId) return player;
      const team = teamById.get(Number(overrideTeamId));
      if (!team) return player;
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

  private async buildRosterOverridesByTeam(
    saveId: number | undefined,
    teams: Array<{ id: number; shortName: string }>,
    baseByTeam: Map<string, any[]>,
  ) {
    if (!saveId) return new Map<string, any[]>();
    const save = await prisma.save.findUnique({ where: { id: saveId }, select: { data: true } });
    const payload = (save?.data ?? {}) as { transferState?: { playerTeamOverrides?: Record<string, number> } };
    const overrides = payload.transferState?.playerTeamOverrides ?? {};
    if (Object.keys(overrides).length === 0) return new Map<string, any[]>();

    const teamCodeById = new Map(teams.map((t) => [t.id, t.shortName]));
    const all = [...baseByTeam.entries()].flatMap(([code, roster]) => roster.map((p) => ({ ...p, rosterTeamCode: p.rosterTeamCode ?? code })));
    const byPlayerId = new Map(all.filter((p) => p.id != null).map((p) => [p.id, p]));
    const out = new Map<string, any[]>();
    for (const [code, roster] of baseByTeam.entries()) out.set(code, [...roster]);

    for (const [playerIdKey, newTeamId] of Object.entries(overrides)) {
      const playerId = Number(playerIdKey);
      const targetCode = teamCodeById.get(Number(newTeamId));
      const player = byPlayerId.get(playerId);
      if (!player || !targetCode) continue;
      for (const [code, roster] of out.entries()) out.set(code, roster.filter((p) => p.id !== playerId));
      out.set(targetCode, [...(out.get(targetCode) ?? []), { ...player, rosterTeamCode: targetCode, teamId: Number(newTeamId) }]);
    }

    return out;
  }
}

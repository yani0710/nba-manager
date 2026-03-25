import prisma from "../../config/prisma";
import { resolveDetailedPosition } from "../../data/loadDetailedPositions";

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

export class TeamsService {
  async getAllTeams(saveId?: number) {
    const teams = await prisma.team.findMany({
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

  async getTeamById(id: number, saveId?: number) {
    const team = await prisma.team.findFirst({
      where: { id, shortName: { not: FREE_AGENT_TEAM_SHORT } },
      include: {
        homeGames: true,
        awayGames: true,
      },
    });
    if (!team) return null;
    const rosterByTeamId = await this.buildRosterByTeamId(saveId, [team.id]);
    const [withState] = await this.attachTeamState([{
      ...team,
      players: rosterByTeamId.get(team.id) ?? [],
      rosterMissingEnrichmentCount: 0,
    }], saveId);
    return withState ?? null;
  }

  async getTeamByName(name: string, saveId?: number) {
    const team = await prisma.team.findFirst({
      where: { name, shortName: { not: FREE_AGENT_TEAM_SHORT } },
    });
    if (!team) return null;
    const rosterByTeamId = await this.buildRosterByTeamId(saveId, [team.id]);
    const [withState] = await this.attachTeamState([{
      ...team,
      players: rosterByTeamId.get(team.id) ?? [],
      rosterMissingEnrichmentCount: 0,
    }], saveId);
    return withState ?? null;
  }

  async getRosterByTeamId(id: number, saveId?: number) {
    const team = await prisma.team.findFirst({
      where: { id, shortName: { not: FREE_AGENT_TEAM_SHORT } },
    });
    if (!team) return null;

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

  private resolveSalary(player: {
    salary?: number | null;
    contracts?: {
      currentYearSalary?: number | null;
      salary?: number | null;
      averageAnnualValue?: number | null;
      contractYears?: Array<{ salary?: number | null }>;
    } | null;
  }) {
    const direct = Number(player.salary);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const c = player.contracts;
    const currentYear = Number(c?.currentYearSalary);
    if (Number.isFinite(currentYear) && currentYear > 0) return currentYear;

    const baseSalary = Number(c?.salary);
    if (Number.isFinite(baseSalary) && baseSalary > 0) return baseSalary;

    const aav = Number(c?.averageAnnualValue);
    if (Number.isFinite(aav) && aav > 0) return aav;

    const years = Array.isArray(c?.contractYears) ? c.contractYears : [];
    const firstYear = years
      .map((row) => Number(row?.salary))
      .find((n) => Number.isFinite(n) && n > 0);
    if (firstYear != null && Number.isFinite(firstYear) && firstYear > 0) return firstYear;

    return null;
  }

  private async buildRosterByTeamId(saveId: number | undefined, teamIds?: number[]) {
    const [players, teams, save] = await Promise.all([
      prisma.player.findMany({
        where: { active: true },
        include: {
          team: true,
          contracts: { select: contractSelect },
        },
        orderBy: [{ overallCurrent: "desc" }, { overall: "desc" }, { name: "asc" }],
      }),
      prisma.team.findMany({
        where: { shortName: { not: FREE_AGENT_TEAM_SHORT } },
        select: { id: true, shortName: true, name: true, city: true },
      }),
      saveId
        ? prisma.save.findUnique({ where: { id: saveId }, select: { data: true } })
        : Promise.resolve(null),
    ]);

    const payload = (save?.data ?? {}) as { transferState?: { playerTeamOverrides?: Record<string, number> } };
    const overrides = payload.transferState?.playerTeamOverrides ?? {};
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const allowed = teamIds ? new Set(teamIds) : null;

    const grouped = new Map<number, any[]>();
    for (const player of players) {
      const overrideTeamId = overrides[String(player.id)];
      const effectiveTeamId = Number(overrideTeamId ?? player.teamId);
      if (!Number.isFinite(effectiveTeamId)) continue;
      if (allowed && !allowed.has(effectiveTeamId)) continue;
      const targetTeam = teamById.get(effectiveTeamId);
      if (!targetTeam) continue;

      const list = grouped.get(effectiveTeamId) ?? [];
      list.push({
        ...player,
        teamId: effectiveTeamId,
        position: resolveDetailedPosition(player.name, targetTeam.shortName, player.position) ?? player.position,
        primaryPosition: resolveDetailedPosition(player.name, targetTeam.shortName, (player as any).primaryPosition ?? player.position) ?? (player as any).primaryPosition ?? player.position,
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
      grouped.set(
        teamId,
        roster.sort((a, b) => {
          const parseJersey = (p: any) => {
            const code = String(p.jerseyCode ?? "").trim();
            if (code) {
              const n = Number(code);
              if (Number.isFinite(n)) return n;
            }
            return p.jerseyNumber ?? p.number ?? 999;
          };
          const anum = parseJersey(a);
          const bnum = parseJersey(b);
          return anum - bnum || String(a.name).localeCompare(String(b.name));
        }),
      );
    }

    return grouped;
  }

  private async attachTeamState<T extends { id: number }>(teams: T[], saveId?: number) {
    if (!saveId || teams.length === 0) return teams;
    const save = await prisma.save.findUnique({
      where: { id: saveId },
      select: { data: true },
    });
    const payload = (save?.data ?? {}) as {
      teamState?: Record<string, { form?: number; last5?: string; streak?: number; offenseRating?: number; defenseRating?: number }>;
    };
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

  private async readSingleTeamState(saveId: number | undefined, teamId: number) {
    if (!saveId) return { form: 50, last5: "", streak: 0, offenseRating: 75, defenseRating: 75 };
    const save = await prisma.save.findUnique({ where: { id: saveId }, select: { data: true } });
    const payload = (save?.data ?? {}) as {
      teamState?: Record<string, { form?: number; last5?: string; streak?: number; offenseRating?: number; defenseRating?: number }>;
    };
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

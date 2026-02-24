import prisma from "../../config/prisma";
import { enrichPlayersFromSalariesRoster } from "../../data/enrichPlayers";

export class TeamsService {
  async getAllTeams(saveId?: number) {
    const salariesRoster = await enrichPlayersFromSalariesRoster();
    const teams = await prisma.team.findMany({
      include: {
        homeGames: true,
        awayGames: true,
      },
      orderBy: { name: "asc" },
    });
    const withRoster = teams.map((team) => ({
      ...team,
      players: salariesRoster.byTeam.get(team.shortName) ?? [],
      rosterMissingEnrichmentCount: (salariesRoster.byTeam.get(team.shortName) ?? []).filter((p) => !p.enrichmentMatched).length,
    }));
    return this.attachTeamState(withRoster, saveId);
  }

  async getTeamById(id: number, saveId?: number) {
    const salariesRoster = await enrichPlayersFromSalariesRoster();
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        homeGames: true,
        awayGames: true,
      },
    });
    if (!team) return null;
    const [withState] = await this.attachTeamState([{
      ...team,
      players: salariesRoster.byTeam.get(team.shortName) ?? [],
      rosterMissingEnrichmentCount: (salariesRoster.byTeam.get(team.shortName) ?? []).filter((p) => !p.enrichmentMatched).length,
    }], saveId);
    return withState ?? null;
  }

  async getTeamByName(name: string, saveId?: number) {
    const salariesRoster = await enrichPlayersFromSalariesRoster();
    const team = await prisma.team.findUnique({
      where: { name },
    });
    if (!team) return null;
    const [withState] = await this.attachTeamState([{
      ...team,
      players: salariesRoster.byTeam.get(team.shortName) ?? [],
      rosterMissingEnrichmentCount: (salariesRoster.byTeam.get(team.shortName) ?? []).filter((p) => !p.enrichmentMatched).length,
    }], saveId);
    return withState ?? null;
  }

  async getRosterByTeamId(id: number, saveId?: number) {
    const salariesRoster = await enrichPlayersFromSalariesRoster();
    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      return null;
    }

    const roster = salariesRoster.byTeam.get(team.shortName) ?? [];
    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      city: team.city,
      conference: team.conference,
      division: team.division,
      logoPath: team.logoPath,
      roster: roster.slice().sort((a, b) => String(a.position ?? "").localeCompare(String(b.position ?? "")) || a.name.localeCompare(b.name)),
      rosterSource: "nba_salaries_clean.csv",
      rosterEnrichment: {
        total: roster.length,
        missing: roster.filter((p) => !p.enrichmentMatched).length,
      },
      teamState: await this.readSingleTeamState(saveId, team.id),
    };
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

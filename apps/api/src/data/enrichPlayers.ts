import prisma from "../config/prisma";
import { buildTeamRoster, normalizePlayerName, type SalariesRosterRow } from "./loadSalariesRoster";

type EnrichedRosterPlayer = {
  rosterSource: "nba_salaries_clean.csv";
  rosterName: string;
  rosterTeamCode: string;
  salary: number | null;
  contractEndYear: number | null;
  guaranteed: number | null;
  enrichmentMatched: boolean;
  enrichmentWarning?: string;
  id: number | null;
  name: string;
  teamId: number | null;
  team?: { id: number; name: string; shortName: string } | null;
  position: string | null;
  number: number | null;
  jerseyNumber: number | null;
  overall: number | null;
  overallBase: number | null;
  overallCurrent: number | null;
  form: number | null;
  fatigue: number | null;
  morale: number | null;
  heightCm: number | null;
  weightKg: number | null;
  nationality: string | null;
  birthDate: Date | null;
  age: number | null;
  externalRef: string | null;
  attributes?: unknown;
};

export type SalariesRosterHealth = {
  sourceFile: string;
  totalPlayersFromSalaries: number;
  matchedInDb: number;
  missingInDb: number;
  missingSample: string[];
  ambiguousWarnings: string[];
};

function mapTeamCode(v: string): string {
  const aliases: Record<string, string> = { BRK: "BKN", PHO: "PHX", CHO: "CHA", GS: "GSW", SA: "SAS", NO: "NOP", NY: "NYK" };
  return aliases[String(v ?? "").toUpperCase()] ?? String(v ?? "").toUpperCase();
}

export async function enrichPlayersFromSalariesRoster() {
  const { filePath, teamRoster, players: salaryPlayers } = buildTeamRoster();
  const dbPlayers = await prisma.player.findMany({
    where: { active: true },
    include: { team: true, contracts: true },
    orderBy: { name: "asc" },
  });

  const byExternal = new Map<string, (typeof dbPlayers)[number]>();
  const byName = new Map<string, Array<(typeof dbPlayers)[number]>>();
  const byNameTeam = new Map<string, Array<(typeof dbPlayers)[number]>>();

  for (const p of dbPlayers) {
    if (p.externalRef) byExternal.set(String(p.externalRef), p);
    const n = normalizePlayerName(p.name);
    const t = mapTeamCode(p.team?.shortName ?? "");
    byName.set(n, [...(byName.get(n) ?? []), p]);
    byNameTeam.set(`${n}|${t}`, [...(byNameTeam.get(`${n}|${t}`) ?? []), p]);
  }

  const ambiguousWarnings: string[] = [];
  const missingSample: string[] = [];
  let matchedInDb = 0;

  const enrichRow = (row: SalariesRosterRow): EnrichedRosterPlayer => {
    const byTeamCandidates = byNameTeam.get(`${row.normalizedName}|${row.teamCode}`) ?? [];
    let matched = byTeamCandidates[0] ?? null;
    let warning: string | undefined;
    if (!matched) {
      const nameCandidates = byName.get(row.normalizedName) ?? [];
      if (nameCandidates.length > 1) {
        warning = `ambiguous:${row.rawName}|${row.teamCode}|${nameCandidates.map((p) => `${p.name}/${p.team.shortName}`).join(",")}`;
        ambiguousWarnings.push(warning);
      }
      matched = nameCandidates[0] ?? null;
    }

    if (!matched) {
      if (missingSample.length < 20) missingSample.push(`${row.rawName} (${row.teamCode})`);
      return {
        rosterSource: "nba_salaries_clean.csv",
        rosterName: row.rawName,
        rosterTeamCode: row.teamCode,
        salary: row.salary,
        contractEndYear: row.contractEndYear,
        guaranteed: row.guaranteed,
        enrichmentMatched: false,
        id: null,
        name: row.rawName,
        teamId: null,
        team: null,
        position: null,
        number: null,
        jerseyNumber: null,
        overall: null,
        overallBase: null,
        overallCurrent: null,
        form: null,
        fatigue: null,
        morale: null,
        heightCm: null,
        weightKg: null,
        nationality: null,
        birthDate: null,
        age: null,
        externalRef: null,
      };
    }

    matchedInDb += 1;
    return {
      rosterSource: "nba_salaries_clean.csv",
      rosterName: row.rawName,
      rosterTeamCode: row.teamCode,
      salary: row.salary ?? matched.salary ?? null,
      contractEndYear: row.contractEndYear,
      guaranteed: row.guaranteed,
      enrichmentMatched: true,
      enrichmentWarning: warning,
      id: matched.id,
      name: matched.name,
      teamId: matched.teamId,
      team: matched.team ? { id: matched.team.id, name: matched.team.name, shortName: matched.team.shortName } : null,
      position: matched.position ?? null,
      number: matched.number ?? null,
      jerseyNumber: matched.jerseyNumber ?? null,
      overall: matched.overall ?? null,
      overallBase: matched.overallBase ?? null,
      overallCurrent: matched.overallCurrent ?? null,
      form: matched.form ?? null,
      fatigue: matched.fatigue ?? null,
      morale: matched.morale ?? null,
      heightCm: matched.heightCm ?? null,
      weightKg: matched.weightKg ?? null,
      nationality: matched.nationality ?? null,
      birthDate: matched.birthDate ?? null,
      age: matched.age ?? null,
      externalRef: matched.externalRef ?? null,
      attributes: matched.attributes,
    };
  };

  const enrichedByTeam = new Map<string, EnrichedRosterPlayer[]>();
  for (const [teamCode, rows] of teamRoster.entries()) {
    enrichedByTeam.set(teamCode, rows.map(enrichRow));
  }

  const health: SalariesRosterHealth = {
    sourceFile: filePath,
    totalPlayersFromSalaries: salaryPlayers.length,
    matchedInDb,
    missingInDb: salaryPlayers.length - matchedInDb,
    missingSample,
    ambiguousWarnings: ambiguousWarnings.slice(0, 20),
  };

  return { byTeam: enrichedByTeam, health };
}


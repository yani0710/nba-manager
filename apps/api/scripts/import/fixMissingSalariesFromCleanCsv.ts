import "dotenv/config";
import prisma from "../../src/config/prisma";
import { buildTeamRoster, normalizePlayerName } from "../../src/data/loadSalariesRoster";
import { mapTeamCode } from "./utils";

function fromContract(player: {
  contracts?: {
    currentYearSalary?: number | null;
    salary?: number | null;
    averageAnnualValue?: number | null;
    contractYears?: Array<{ salary?: number | null }>;
  } | null;
}) {
  const current = Number(player.contracts?.currentYearSalary);
  if (Number.isFinite(current) && current > 0) return current;
  const base = Number(player.contracts?.salary);
  if (Number.isFinite(base) && base > 0) return base;
  const aav = Number(player.contracts?.averageAnnualValue);
  if (Number.isFinite(aav) && aav > 0) return aav;
  const years = Array.isArray(player.contracts?.contractYears) ? player.contracts?.contractYears : [];
  const yearSalary = years.map((y) => Number(y?.salary)).find((n) => Number.isFinite(n) && n > 0);
  if (yearSalary != null && Number.isFinite(yearSalary) && yearSalary > 0) return yearSalary;
  return null;
}

async function main() {
  const roster = buildTeamRoster();
  const salaryByNameTeam = new Map<string, number>();
  const salaryByName = new Map<string, number>();

  for (const row of roster.players) {
    const s = Number(row.salary);
    if (!Number.isFinite(s) || s <= 0) continue;
    const key = `${row.normalizedName}|${mapTeamCode(row.teamCode)}`;
    const prevTeam = salaryByNameTeam.get(key) ?? 0;
    if (s > prevTeam) salaryByNameTeam.set(key, s);
    const prevName = salaryByName.get(row.normalizedName) ?? 0;
    if (s > prevName) salaryByName.set(row.normalizedName, s);
  }

  const players = await prisma.player.findMany({
    where: {
      active: true,
      team: { shortName: { not: "FA" } },
      OR: [{ salary: null }, { salary: { lte: 0 } }],
    },
    include: {
      team: { select: { shortName: true } },
      contracts: {
        select: {
          currentYearSalary: true,
          salary: true,
          averageAnnualValue: true,
          contractYears: true,
        },
      },
    },
  });

  let matchedByTeam = 0;
  let matchedByName = 0;
  let matchedByContract = 0;
  let defaulted = 0;
  const unresolvedSample: string[] = [];

  for (const player of players) {
    const norm = normalizePlayerName(player.name);
    const teamCode = mapTeamCode(player.team.shortName);

    const byTeam = salaryByNameTeam.get(`${norm}|${teamCode}`) ?? null;
    const byName = salaryByName.get(norm) ?? null;
    const contractSalary = fromContract(player);

    let nextSalary: number | null = null;
    if (byTeam && byTeam > 0) {
      nextSalary = byTeam;
      matchedByTeam += 1;
    } else if (byName && byName > 0) {
      nextSalary = byName;
      matchedByName += 1;
    } else if (contractSalary && contractSalary > 0) {
      nextSalary = contractSalary;
      matchedByContract += 1;
    } else {
      nextSalary = 1_500_000;
      defaulted += 1;
      if (unresolvedSample.length < 30) unresolvedSample.push(`${player.name} (${player.team.shortName})`);
    }

    await prisma.player.update({
      where: { id: player.id },
      data: { salary: Math.round(nextSalary) },
    });
  }

  console.log(
    JSON.stringify(
      {
        candidates: players.length,
        matchedByTeam,
        matchedByName,
        matchedByContract,
        defaulted,
        unresolvedSample,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


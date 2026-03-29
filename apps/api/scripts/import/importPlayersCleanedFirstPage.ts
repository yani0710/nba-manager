import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildTeamRoster, normalizePlayerName } from "../../src/data/loadSalariesRoster";
import { mapTeamCode, readCsvRowsFromPath, toInt } from "./utils";

const prisma = new PrismaClient();
const FREE_AGENT_TEAM_SHORT = "FA";

function parseHeightCm(raw: string): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const match = value.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return Math.round((feet * 12 + inches) * 2.54);
}

function parseWeightKg(raw: string): number | null {
  const n = toInt(String(raw ?? "").replace(/lbs?/i, "").trim());
  if (n === null) return null;
  return Math.round(n * 0.45359237);
}

function parsePosition(raw: string): { position: string; primary: string; secondary: string | null } {
  const cleaned = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return { position: "N/A", primary: "N/A", secondary: null };
  const parts = cleaned.split("-").filter(Boolean);
  const primary = parts[0] ?? cleaned;
  const secondary = parts[1] ?? null;
  return { position: primary, primary, secondary };
}

function parseJersey(raw: unknown): { code: string | null; numeric: number | null } {
  const value = String(raw ?? "").trim();
  if (!value) return { code: null, numeric: null };
  const digitsOnly = value.replace(/[^\d]/g, "");
  if (!digitsOnly) return { code: null, numeric: null };
  const normalized = digitsOnly.length > 2 ? digitsOnly.slice(-2) : digitsOnly;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return { code: null, numeric: null };
  return { code: normalized, numeric: Math.trunc(numeric) };
}

function deterministic(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function freeAgentBaseOverall(name: string): number {
  return 60 + (deterministic(name) % 6); // 60..65
}

function nonFreeAgentBaseOverall(name: string, salary: number | null): number {
  const s = Number(salary ?? 0);
  if (Number.isFinite(s) && s > 0) {
    const m = s / 1_000_000;
    const bySalary =
      m >= 50 ? 92 :
      m >= 45 ? 90 :
      m >= 40 ? 88 :
      m >= 35 ? 86 :
      m >= 30 ? 84 :
      m >= 25 ? 82 :
      m >= 20 ? 79 :
      m >= 15 ? 76 :
      m >= 10 ? 73 :
      m >= 7 ? 70 :
      m >= 4 ? 67 :
      64;
    return bySalary;
  }
  return 66 + (deterministic(name) % 8); // 66..73 fallback if salary missing
}

async function ensureFreeAgentTeam() {
  const existing = await prisma.team.findUnique({
    where: { shortName: FREE_AGENT_TEAM_SHORT },
  });
  if (existing) return existing;
  return prisma.team.create({
    data: {
      name: "Free Agents",
      shortName: FREE_AGENT_TEAM_SHORT,
      city: "Free Agents",
      conference: null,
      division: null,
      logoPath: null,
      logoKey: null,
      primaryColor: "#666666",
      secondaryColor: "#AAAAAA",
    },
  });
}

async function main() {
  const sourcePath = path.resolve(process.cwd(), "data", "players_cleaned_with_first_page.csv");
  const rows = readCsvRowsFromPath(sourcePath);
  const freeAgentTeam = await ensureFreeAgentTeam();

  const teams = await prisma.team.findMany({
    select: { id: true, shortName: true },
  });
  const teamIdByCode = new Map(teams.map((t) => [mapTeamCode(t.shortName), t.id]));

  const existingPlayers = await prisma.player.findMany({
    where: { active: true },
    select: { id: true, name: true, teamId: true, number: true },
  });
  const byName = new Map<string, Array<(typeof existingPlayers)[number]>>();
  for (const player of existingPlayers) {
    const key = normalizePlayerName(player.name);
    byName.set(key, [...(byName.get(key) ?? []), player]);
  }

  const rosterSalary = buildTeamRoster();
  const salaryByNameTeam = new Map<string, number>();
  const salaryByName = new Map<string, number>();
  for (const row of rosterSalary.players) {
    if (!Number.isFinite(Number(row.salary)) || Number(row.salary) <= 0) continue;
    const s = Number(row.salary);
    const key = `${row.normalizedName}|${mapTeamCode(row.teamCode)}`;
    const prevTeam = salaryByNameTeam.get(key) ?? 0;
    if (s > prevTeam) salaryByNameTeam.set(key, s);
    const prevName = salaryByName.get(row.normalizedName) ?? 0;
    if (s > prevName) salaryByName.set(row.normalizedName, s);
  }

  let created = 0;
  let updated = 0;
  let toFreeAgents = 0;
  let unresolved = 0;
  const unresolvedSample: string[] = [];

  for (const row of rows) {
    const name = String(row.Player ?? "").trim();
    if (!name) continue;

    const normalizedName = normalizePlayerName(name);
    const csvTeamCodeRaw = String(row.Team ?? "").trim().toUpperCase();
    const mappedTeamCode = csvTeamCodeRaw ? mapTeamCode(csvTeamCodeRaw) : "";
    const teamId = mappedTeamCode ? teamIdByCode.get(mappedTeamCode) ?? freeAgentTeam.id : freeAgentTeam.id;
    const isFreeAgent = teamId === freeAgentTeam.id;
    if (isFreeAgent) toFreeAgents += 1;

    const jersey = parseJersey(row.Number);
    const { position, primary, secondary } = parsePosition(String(row.Position ?? ""));
    const heightCm = parseHeightCm(String(row.Height ?? ""));
    const weightKg = parseWeightKg(String(row.Weight ?? ""));
    const nationality = String(row.Country ?? "").trim() || null;
    const school = String(row["Last Attended"] ?? "").trim() || null;

    const salary =
      salaryByNameTeam.get(`${normalizedName}|${mappedTeamCode}`) ??
      salaryByName.get(normalizedName) ??
      null;

    const candidates = byName.get(normalizedName) ?? [];
    const sameTeamCandidates = candidates.filter((p) => p.teamId === teamId);
    const current =
      sameTeamCandidates.find((p) => normalizePlayerName(p.name) === normalizedName && p.name.toLowerCase() === name.toLowerCase()) ??
      sameTeamCandidates[0] ??
      candidates[0] ??
      null;

    const faOverall = freeAgentBaseOverall(name);
    const payload = {
      teamId,
      active: true,
      isActive: true,
      number: jersey.numeric ?? null,
      jerseyNumber: jersey.numeric ?? null,
      jerseyCode: jersey.code ?? null,
      position,
      primaryPosition: primary,
      secondaryPosition: secondary ?? undefined,
      heightCm: heightCm ?? undefined,
      weightKg: weightKg ?? undefined,
      nationality: nationality ?? null,
      school: school ?? null,
      salary: (salary && salary > 0) ? salary : (isFreeAgent ? 1_500_000 : undefined),
      overallBase: isFreeAgent ? faOverall : undefined,
      overallCurrent: isFreeAgent ? faOverall : undefined,
      overall: isFreeAgent ? faOverall : undefined,
      potential: isFreeAgent ? Math.max(65, faOverall + 8) : undefined,
    };
    const payloadWithoutNumber = {
      ...payload,
      number: null,
      jerseyNumber: null,
      jerseyCode: null,
    };

    try {
      if (current) {
        await prisma.player.update({
          where: { id: current.id },
          data: payload,
        });
        if (sameTeamCandidates.length > 1) {
          const duplicateIds = sameTeamCandidates.filter((p) => p.id !== current.id).map((p) => p.id);
          if (duplicateIds.length > 0) {
            await prisma.player.updateMany({
              where: { id: { in: duplicateIds } },
              data: {
                nationality: nationality ?? null,
                school: school ?? null,
              },
            });
          }
        }
        updated += 1;
      } else {
        const nonFaOverall = nonFreeAgentBaseOverall(name, salary);
        await prisma.player.create({
          data: {
            name,
            teamId,
            position,
            primaryPosition: primary,
            active: true,
            isActive: true,
            number: jersey.numeric ?? null,
            jerseyNumber: jersey.numeric ?? null,
            jerseyCode: jersey.code ?? null,
            heightCm: heightCm ?? undefined,
            weightKg: weightKg ?? undefined,
            nationality: nationality ?? undefined,
            school: school ?? undefined,
            salary: (salary && salary > 0) ? salary : (isFreeAgent ? 1_500_000 : null),
            overallBase: isFreeAgent ? faOverall : nonFaOverall,
            overallCurrent: isFreeAgent ? faOverall : nonFaOverall,
            overall: isFreeAgent ? faOverall : nonFaOverall,
            potential: isFreeAgent ? Math.max(65, faOverall + 8) : Math.max(74, nonFaOverall + 6),
          },
        });
        created += 1;
      }
    } catch {
      try {
        if (current) {
          await prisma.player.update({
            where: { id: current.id },
            data: payloadWithoutNumber,
          });
          if (sameTeamCandidates.length > 1) {
            const duplicateIds = sameTeamCandidates.filter((p) => p.id !== current.id).map((p) => p.id);
            if (duplicateIds.length > 0) {
              await prisma.player.updateMany({
                where: { id: { in: duplicateIds } },
                data: {
                  nationality: nationality ?? null,
                  school: school ?? null,
                },
              });
            }
          }
          updated += 1;
        } else {
          const nonFaOverall = nonFreeAgentBaseOverall(name, salary);
          await prisma.player.create({
            data: {
              name,
              teamId,
              position,
              primaryPosition: primary,
              active: true,
              isActive: true,
              heightCm: heightCm ?? undefined,
              weightKg: weightKg ?? undefined,
              nationality: nationality ?? undefined,
              school: school ?? undefined,
              salary: (salary && salary > 0) ? salary : (isFreeAgent ? 1_500_000 : null),
              overallBase: isFreeAgent ? faOverall : nonFaOverall,
              overallCurrent: isFreeAgent ? faOverall : nonFaOverall,
              overall: isFreeAgent ? faOverall : nonFaOverall,
              potential: isFreeAgent ? Math.max(65, faOverall + 8) : Math.max(74, nonFaOverall + 6),
            },
          });
          created += 1;
        }
      } catch {
        unresolved += 1;
        if (unresolvedSample.length < 20) {
          unresolvedSample.push(`${name} (${mappedTeamCode || "FA"})`);
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        source: sourcePath,
        rows: rows.length,
        created,
        updated,
        toFreeAgents,
        unresolved,
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
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

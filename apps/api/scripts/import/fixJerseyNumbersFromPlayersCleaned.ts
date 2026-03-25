import "dotenv/config";
import path from "node:path";
import prisma from "../../src/config/prisma";
import { mapTeamCode, normalizeName, readCsvRowsFromPath } from "./utils";

type Assignment = {
  playerId: number;
  playerName: string;
  teamId: number;
  teamCode: string;
  desiredCode: string;
  desiredNumber: number;
  salary: number | null;
  overallCurrent: number | null;
};

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

function pickFreeCode(used: Set<string>): string {
  if (!used.has("00")) return "00";
  for (let n = 0; n <= 99; n += 1) {
    const code = String(n);
    if (!used.has(code)) return code;
  }
  return "99";
}

async function main() {
  const sourcePath = path.resolve(process.cwd(), "data", "players_cleaned_with_first_page.csv");
  const rows = readCsvRowsFromPath(sourcePath);

  const teams = await prisma.team.findMany({
    select: { id: true, shortName: true },
  });
  const teamIdByCode = new Map(teams.map((t) => [mapTeamCode(t.shortName), t.id]));

  const activePlayers = await prisma.player.findMany({
    where: { active: true, team: { shortName: { not: "FA" } } },
    select: {
      id: true,
      name: true,
      teamId: true,
      number: true,
      jerseyNumber: true,
      jerseyCode: true,
      salary: true,
      overallCurrent: true,
      team: { select: { shortName: true } },
    },
  });

  const byTeamAndNorm = new Map<string, typeof activePlayers[number][]>();
  const byNorm = new Map<string, typeof activePlayers[number][]>();
  for (const p of activePlayers) {
    const key = `${p.teamId}|${normalizeName(p.name)}`;
    const list = byTeamAndNorm.get(key) ?? [];
    list.push(p);
    byTeamAndNorm.set(key, list);
    const nameKey = normalizeName(p.name);
    const byName = byNorm.get(nameKey) ?? [];
    byName.push(p);
    byNorm.set(nameKey, byName);
  }

  const assignmentByPlayerId = new Map<number, Assignment>();
  const unresolved: string[] = [];
  const duplicateCsvAssignments: string[] = [];
  const seenCsv = new Set<string>();

  for (const row of rows) {
    const rawName = String(row.Player ?? "").trim();
    const rawTeam = String(row.Team ?? "").trim();
    const parsed = parseJersey(row.Number);
    if (!rawName || parsed.code == null || parsed.numeric == null || parsed.numeric < 0) continue;

    const norm = normalizeName(rawName);
    const teamCode = rawTeam ? mapTeamCode(rawTeam.toUpperCase()) : "";
    const teamId = teamCode ? teamIdByCode.get(teamCode) : undefined;
    const csvKey = `${teamId ?? "ANY"}|${norm}`;
    if (seenCsv.has(csvKey)) continue;
    seenCsv.add(csvKey);

    let candidates: typeof activePlayers = [];
    if (teamId) {
      candidates = byTeamAndNorm.get(`${teamId}|${norm}`) ?? [];
    }
    if (candidates.length === 0) {
      const nameCandidates = byNorm.get(norm) ?? [];
      if (nameCandidates.length === 1) {
        candidates = nameCandidates;
      } else if (nameCandidates.length > 1 && teamId) {
        candidates = nameCandidates.filter((p) => p.teamId === teamId);
      }
    }

    if (candidates.length === 0) {
      unresolved.push(`${rawName} (${teamCode || "ANY"})`);
      continue;
    }

    const exact = candidates.find((p) => p.name.toLowerCase() === rawName.toLowerCase()) ?? candidates[0];
    assignmentByPlayerId.set(exact.id, {
      playerId: exact.id,
      playerName: exact.name,
      teamId: exact.teamId,
      teamCode: exact.team.shortName,
      desiredNumber: parsed.numeric,
      desiredCode: parsed.code,
      salary: exact.salary,
      overallCurrent: exact.overallCurrent,
    });
  }

  const assignments = [...assignmentByPlayerId.values()];
  const byTeam = new Map<number, Assignment[]>();
  for (const a of assignments) {
    const list = byTeam.get(a.teamId) ?? [];
    list.push(a);
    byTeam.set(a.teamId, list);
  }

  let assigned = 0;
  let clearedConflicts = 0;
  let skippedDuplicates = 0;
  let fallbackAssigned = 0;
  let forceFilledMissing = 0;
  let backfilledFromNumeric = 0;

  for (const [teamId, teamAssignments] of byTeam.entries()) {
    const numberToCandidates = new Map<string, Assignment[]>();
    for (const a of teamAssignments) {
      const list = numberToCandidates.get(a.desiredCode) ?? [];
      list.push(a);
      numberToCandidates.set(a.desiredCode, list);
    }
    const numberToAssignment = new Map<string, Assignment>();
    const duplicatesForFallback: Assignment[] = [];
    for (const [desiredCode, candidates] of numberToCandidates.entries()) {
      const ranked = [...candidates].sort((a, b) => {
        const aSalary = Number(a.salary ?? 0);
        const bSalary = Number(b.salary ?? 0);
        const aOvr = Number(a.overallCurrent ?? 0);
        const bOvr = Number(b.overallCurrent ?? 0);
        if (bSalary !== aSalary) return bSalary - aSalary;
        if (bOvr !== aOvr) return bOvr - aOvr;
        return a.playerName.localeCompare(b.playerName);
      });
      numberToAssignment.set(desiredCode, ranked[0]);
      if (ranked.length > 1) {
        skippedDuplicates += ranked.length - 1;
        duplicateCsvAssignments.push(
          `${ranked[0].teamCode} #${desiredCode}: kept ${ranked[0].playerName}; fallback ${ranked.slice(1).map((x) => x.playerName).join(", ")}`,
        );
        duplicatesForFallback.push(...ranked.slice(1));
      }
    }
    const finalAssignments = [...numberToAssignment.values()];
    if (finalAssignments.length === 0) continue;

    const desiredCodes = finalAssignments.map((a) => a.desiredCode);
    const assignedIds = finalAssignments.map((a) => a.playerId);

    const conflictingHolders = await prisma.player.findMany({
      where: {
        teamId,
        jerseyCode: { in: desiredCodes },
        id: { notIn: assignedIds },
      },
      select: { id: true },
    });

    if (conflictingHolders.length > 0) {
      await prisma.player.updateMany({
        where: { id: { in: conflictingHolders.map((p) => p.id) } },
        data: { number: null, jerseyNumber: null },
      });
      clearedConflicts += conflictingHolders.length;
    }

    // Two-phase assignment avoids unique conflicts when players swap numbers.
    await prisma.player.updateMany({
      where: { id: { in: assignedIds } },
      data: { number: null, jerseyNumber: null },
    });

    for (const a of finalAssignments) {
      await prisma.player.update({
        where: { id: a.playerId },
        data: { number: a.desiredNumber, jerseyNumber: a.desiredNumber, jerseyCode: a.desiredCode },
      });
      assigned += 1;
    }

    if (duplicatesForFallback.length > 0) {
      const teamNumbers = await prisma.player.findMany({
        where: { teamId, jerseyCode: { not: null } },
        select: { jerseyCode: true },
      });
      const used = new Set<string>(
        teamNumbers
          .map((r) => String(r.jerseyCode ?? "").trim())
          .filter((v) => Boolean(v)),
      );

      for (const a of duplicatesForFallback) {
        const fallback = pickFreeCode(used);
        used.add(fallback);
        const fallbackNum = Number(fallback);
        await prisma.player.update({
          where: { id: a.playerId },
          data: {
            number: Number.isFinite(fallbackNum) ? fallbackNum : null,
            jerseyNumber: Number.isFinite(fallbackNum) ? fallbackNum : null,
            jerseyCode: fallback,
          },
        });
        fallbackAssigned += 1;
      }
    }
  }

  // Force-fill any still-missing active team players so Team/Squad never show '-'
  const stillMissing = await prisma.player.findMany({
    where: {
      active: true,
      team: { shortName: { not: "FA" } },
      number: null,
      jerseyNumber: null,
    },
      select: { id: true, teamId: true },
    });
  const byTeamMissing = new Map<number, number[]>();
  for (const p of stillMissing) {
    const list = byTeamMissing.get(p.teamId) ?? [];
    list.push(p.id);
    byTeamMissing.set(p.teamId, list);
  }
  for (const [teamId, playerIds] of byTeamMissing.entries()) {
    const usedRows = await prisma.player.findMany({
      where: { teamId, jerseyCode: { not: null } },
      select: { jerseyCode: true },
    });
    const used = new Set<string>(
      usedRows
        .map((r) => String(r.jerseyCode ?? "").trim())
        .filter((v) => Boolean(v)),
    );
    for (const playerId of playerIds) {
      const fill = pickFreeCode(used);
      used.add(fill);
      const fillNum = Number(fill);
      await prisma.player.update({
        where: { id: playerId },
        data: {
          number: Number.isFinite(fillNum) ? fillNum : null,
          jerseyNumber: Number.isFinite(fillNum) ? fillNum : null,
          jerseyCode: fill,
        },
      });
      forceFilledMissing += 1;
    }
  }

  const needsBackfill = await prisma.player.findMany({
    where: {
      active: true,
      team: { shortName: { not: "FA" } },
      jerseyCode: null,
      OR: [{ jerseyNumber: { not: null } }, { number: { not: null } }],
    },
    select: { id: true, teamId: true, jerseyNumber: true, number: true },
  });
  const byTeamBackfill = new Map<number, typeof needsBackfill>();
  for (const player of needsBackfill) {
    const list = byTeamBackfill.get(player.teamId) ?? [];
    list.push(player);
    byTeamBackfill.set(player.teamId, list);
  }
  for (const [teamId, playersToBackfill] of byTeamBackfill.entries()) {
    const usedRows = await prisma.player.findMany({
      where: { teamId, jerseyCode: { not: null } },
      select: { jerseyCode: true },
    });
    const used = new Set<string>(
      usedRows
        .map((r) => String(r.jerseyCode ?? "").trim())
        .filter((v) => Boolean(v)),
    );

    for (const player of playersToBackfill) {
      const base = player.jerseyNumber ?? player.number;
      if (base == null) continue;
      let code = String(base);
      if (used.has(code)) {
        code = pickFreeCode(used);
      }
      used.add(code);
      await prisma.player.update({
        where: { id: player.id },
        data: { jerseyCode: code },
      });
      backfilledFromNumeric += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        source: sourcePath,
        assignmentsPlanned: assignments.length,
        assigned,
        fallbackAssigned,
        forceFilledMissing,
        backfilledFromNumeric,
        clearedConflicts,
        unresolvedCount: unresolved.length,
        unresolvedSample: unresolved.slice(0, 30),
        skippedDuplicateCsvAssignments: skippedDuplicates,
        duplicateCsvSample: duplicateCsvAssignments.slice(0, 30),
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

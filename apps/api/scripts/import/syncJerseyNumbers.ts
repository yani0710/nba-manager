import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { mapTeamCode, normalizeName } from "./utils";

const prisma = new PrismaClient();

type SeedPlayer = {
  firstName?: string;
  lastName?: string;
  teamShortName?: string;
  number?: number | null;
};

function toName(firstName?: string, lastName?: string): string {
  return `${String(firstName ?? "").trim()} ${String(lastName ?? "").trim()}`.trim();
}

async function main() {
  const filePath = path.resolve(process.cwd(), "prisma", "data", "players.nba.2025-26.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Jersey source file not found: ${filePath}`);
  }

  const seed = JSON.parse(fs.readFileSync(filePath, "utf8")) as SeedPlayer[];
  const byNameTeam = new Map<string, number>();
  const byName = new Map<string, number[]>();

  for (const row of seed) {
    const rawName = toName(row.firstName, row.lastName);
    const number = typeof row.number === "number" ? row.number : null;
    if (!rawName || number === null) continue;

    const normalizedName = normalizeName(rawName);
    const teamCode = mapTeamCode(String(row.teamShortName ?? "").toUpperCase());
    if (teamCode) {
      byNameTeam.set(`${normalizedName}|${teamCode}`, number);
    }

    byName.set(normalizedName, [...(byName.get(normalizedName) ?? []), number]);
  }

  const players = await prisma.player.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      teamId: true,
      number: true,
      jerseyNumber: true,
      team: { select: { shortName: true } },
    },
    orderBy: [{ teamId: "asc" }, { name: "asc" }],
  });

  const rosterNumberRows = await prisma.player.findMany({
    select: { id: true, teamId: true, number: true, active: true },
  });
  const isActiveById = new Map<number, boolean>(rosterNumberRows.map((row) => [row.id, row.active]));

  const usedByTeam = new Map<number, Map<number, number>>();
  for (const row of rosterNumberRows) {
    if (row.number === null) continue;
    const byNumber = usedByTeam.get(row.teamId) ?? new Map<number, number>();
    byNumber.set(row.number, row.id);
    usedByTeam.set(row.teamId, byNumber);
  }
  for (const player of players) {
    const byNumber = usedByTeam.get(player.teamId) ?? new Map<number, number>();
    usedByTeam.set(player.teamId, byNumber);
  }

  let matched = 0;
  let updated = 0;
  let unmatched = 0;
  let conflicted = 0;
  const sampleChanges: Array<{ id: number; name: string; team: string; from: number | null; to: number }> = [];
  const sampleConflicts: Array<{ id: number; name: string; team: string; wanted: number; occupiedById: number }> = [];

  for (const player of players) {
    const normalizedName = normalizeName(player.name);
    const teamCode = mapTeamCode(String(player.team.shortName ?? "").toUpperCase());
    const key = `${normalizedName}|${teamCode}`;

    let expected = byNameTeam.get(key) ?? null;
    if (expected === null) {
      const byNameCandidates = byName.get(normalizedName) ?? [];
      if (byNameCandidates.length === 1) {
        expected = byNameCandidates[0];
      }
    }

    if (expected === null) {
      unmatched += 1;
      continue;
    }

    matched += 1;
    if (player.number === expected && player.jerseyNumber === expected) {
      continue;
    }

    const byNumber = usedByTeam.get(player.teamId) ?? new Map<number, number>();
    const occupiedBy = byNumber.get(expected);
    let canAssign = occupiedBy === undefined || occupiedBy === player.id;
    if (!canAssign && occupiedBy !== undefined) {
      const occupiedIsActive = isActiveById.get(occupiedBy) ?? true;
      if (!occupiedIsActive) {
        await prisma.player.update({
          where: { id: occupiedBy },
          data: { number: null, jerseyNumber: null, jerseyCode: null },
        });
        byNumber.delete(expected);
        canAssign = true;
      }
    }

    if (!canAssign) {
      conflicted += 1;
      if (sampleConflicts.length < 20) {
        sampleConflicts.push({
          id: player.id,
          name: player.name,
          team: player.team.shortName,
          wanted: expected,
          occupiedById: occupiedBy ?? -1,
        });
      }
      continue;
    }

    if (player.number !== null && player.number !== expected) {
      byNumber.delete(player.number);
    }
    byNumber.set(expected, player.id);
    usedByTeam.set(player.teamId, byNumber);

    await prisma.player.update({
      where: { id: player.id },
      data: {
        number: expected,
        jerseyNumber: expected,
        jerseyCode: String(expected),
      },
    });

    if (sampleChanges.length < 20) {
      sampleChanges.push({
        id: player.id,
        name: player.name,
        team: player.team.shortName,
        from: player.number,
        to: expected,
      });
    }
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        source: "prisma/data/players.nba.2025-26.json",
        activePlayers: players.length,
        matched,
        unmatched,
        updated,
        conflicted,
        sampleChanges,
        sampleConflicts,
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

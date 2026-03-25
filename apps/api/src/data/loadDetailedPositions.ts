import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { normalizePlayerName } from "./loadSalariesRoster";

type PositionIndex = {
  byNameTeam: Map<string, string>;
  byName: Map<string, string>;
};

let cache: PositionIndex | null = null;

export function mapTeamCodeForPositions(input: string): string {
  const v = String(input ?? "").trim().toUpperCase();
  const aliases: Record<string, string> = { BRK: "BKN", PHO: "PHX", CHO: "CHA", GS: "GSW", SA: "SAS", NO: "NOP", NY: "NYK" };
  return aliases[v] ?? v;
}

export function normalizeDetailedPos(raw: string): string | null {
  const v = String(raw ?? "").toUpperCase().replace(/\s+/g, "");
  if (!v) return null;
  if (["PG", "SG", "SF", "PF", "C"].includes(v)) return v;
  const parts = v.split(/[-/]/).filter(Boolean);
  for (const token of ["PG", "SG", "SF", "PF", "C"]) {
    if (parts.includes(token) || v.includes(token)) return token;
  }
  if (v === "G") return "SG";
  if (v === "F") return "SF";
  return null;
}

export function getDetailedPositionIndex(): PositionIndex {
  if (cache) return cache;
  const preferred = path.resolve(process.cwd(), "data", "Advanced.csv");
  const fallback = path.resolve(process.cwd(), "data", "full_stats.csv");
  const csvPath = fs.existsSync(preferred) ? preferred : fallback;
  if (!fs.existsSync(csvPath)) {
    cache = { byNameTeam: new Map(), byName: new Map() };
    return cache;
  }

  const rows = parse(fs.readFileSync(csvPath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const byNameTeamCount = new Map<string, Map<string, number>>();
  const byNameCount = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const rawName = String(row.player ?? row.Player ?? "").trim();
    const rawTeam = String(row.team ?? row.Team ?? row.Tm ?? "").trim();
    const rawPos = String(row.pos ?? row.Pos ?? row.Position ?? "").trim();
    if (!rawName || !rawPos) continue;

    const name = normalizePlayerName(rawName);
    const team = mapTeamCodeForPositions(rawTeam);
    const pos = normalizeDetailedPos(rawPos);
    if (!name || !pos) continue;

    const teamKey = `${name}|${team}`;
    const teamMap = byNameTeamCount.get(teamKey) ?? new Map<string, number>();
    teamMap.set(pos, (teamMap.get(pos) ?? 0) + 1);
    byNameTeamCount.set(teamKey, teamMap);

    const nameMap = byNameCount.get(name) ?? new Map<string, number>();
    nameMap.set(pos, (nameMap.get(pos) ?? 0) + 1);
    byNameCount.set(name, nameMap);
  }

  const pickTop = (countMap: Map<string, number>) => {
    let best = "";
    let bestCount = -1;
    for (const [pos, count] of countMap.entries()) {
      if (count > bestCount) {
        best = pos;
        bestCount = count;
      }
    }
    return best || null;
  };

  const byNameTeam = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const [key, countMap] of byNameTeamCount.entries()) {
    const top = pickTop(countMap);
    if (top) byNameTeam.set(key, top);
  }
  for (const [key, countMap] of byNameCount.entries()) {
    const top = pickTop(countMap);
    if (top) byName.set(key, top);
  }

  cache = { byNameTeam, byName };
  return cache;
}

export function resolveDetailedPosition(
  playerName: string,
  teamCode: string | null | undefined,
  currentPosition: string | null | undefined,
): string | null {
  const index = getDetailedPositionIndex();
  const name = normalizePlayerName(String(playerName ?? ""));
  if (!name) return null;
  const team = mapTeamCodeForPositions(String(teamCode ?? ""));
  const detailed = index.byNameTeam.get(`${name}|${team}`) ?? index.byName.get(name) ?? null;
  if (!detailed) return null;
  return detailed;
}

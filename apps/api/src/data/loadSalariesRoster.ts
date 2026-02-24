import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type SalariesRosterRow = {
  rawName: string;
  normalizedName: string;
  teamCode: string;
  salary: number | null;
  contractEndYear: number | null;
  guaranteed: number | null;
  season?: string | null;
  sourceRow: Record<string, string>;
};

export type TeamRosterMap = Map<string, SalariesRosterRow[]>;

const PLAYER_ALIASES: Record<string, string> = {
  "dennis schroder": "dennis schröder",
  "luka doncic": "luka dončić",
};

function toCsvRows(filePath: string): Array<Record<string, string>> {
  const csv = fs.readFileSync(filePath, "utf8");
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  }) as Array<Record<string, string>>;
}

function dataDir() {
  return path.resolve(process.cwd(), "data");
}

function findSalariesCsv(): string {
  const preferred = path.join(dataDir(), "nba_salaries_clean.csv");
  if (fs.existsSync(preferred)) return preferred;

  const files = fs.readdirSync(dataDir()).filter((f) => f.toLowerCase().endsWith(".csv"));
  for (const file of files) {
    const firstLine = fs.readFileSync(path.join(dataDir(), file), "utf8").split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
    if (firstLine.includes("player") && firstLine.includes("team") && firstLine.includes("salary")) {
      return path.join(dataDir(), file);
    }
  }
  throw new Error("nba_salaries_clean.csv not found (or no salary CSV with Player/Team/Salary headers found)");
}

export function normalizePlayerName(input: string): string {
  const base = String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const alias = PLAYER_ALIASES[base];
  if (!alias) return base;

  // Normalize alias target once and stop. This avoids alias loops caused by mojibake variants
  // collapsing back to the same normalized key (e.g. "schrГ¶der" -> "schroder").
  const normalizedAlias = String(alias)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalizedAlias || base;
}

function toInt(value: unknown): number | null {
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function getSeasonColumns(row: Record<string, string>): Array<{ key: string; startYear: number; endYear: number; value: number }> {
  const cols: Array<{ key: string; startYear: number; endYear: number; value: number }> = [];
  for (const [key, raw] of Object.entries(row)) {
    const m = key.trim().match(/^(\d{4})[-/](\d{2})$/);
    if (!m) continue;
    const startYear = Number(m[1]);
    const endYear = 2000 + Number(m[2]);
    const value = toInt(raw) ?? 0;
    if (value > 0) cols.push({ key, startYear, endYear, value });
  }
  cols.sort((a, b) => a.startYear - b.startYear);
  return cols;
}

function mapTeamCode(input: string): string {
  const v = String(input ?? "").trim().toUpperCase();
  const aliases: Record<string, string> = { BRK: "BKN", PHO: "PHX", CHO: "CHA", GS: "GSW", SA: "SAS", NO: "NOP", NY: "NYK" };
  return aliases[v] ?? v;
}

function pickField(row: Record<string, string>, candidates: string[]): string {
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().replace(/\s+/g, "");
    if (candidates.some((c) => normalized === c || normalized.includes(c))) {
      return row[key];
    }
  }
  return "";
}

export function loadSalariesRosterRows(): { filePath: string; rows: SalariesRosterRow[] } {
  const filePath = findSalariesCsv();
  const rawRows = toCsvRows(filePath);

  const rows = rawRows
    .map((row) => {
      const rawName = pickField(row, ["player", "name"]).trim();
      const teamCode = mapTeamCode(pickField(row, ["team", "teamabbr", "teamcode"]).trim());
      const seasonCols = getSeasonColumns(row);
      const salary =
        toInt(pickField(row, ["salary", "yearlysalary", "amount"])) ??
        seasonCols[0]?.value ??
        null;
      const contractEndYear =
        toInt(pickField(row, ["contractend", "expiry", "endyear", "expyear"])) ??
        seasonCols[seasonCols.length - 1]?.endYear ??
        null;
      const guaranteed = toInt(pickField(row, ["guaranteed", "guaranteedmoney"]));
      const season = pickField(row, ["season", "year"]) || (seasonCols[0] ? `${seasonCols[0].startYear}-${String(seasonCols[0].endYear).slice(-2)}` : "");
      return {
        rawName,
        normalizedName: normalizePlayerName(rawName),
        teamCode,
        salary,
        contractEndYear,
        guaranteed,
        season: season || null,
        sourceRow: row,
      } satisfies SalariesRosterRow;
    })
    .filter((r) => r.rawName && r.teamCode);

  return { filePath, rows };
}

export function buildTeamRoster(): { filePath: string; teamRoster: TeamRosterMap; players: SalariesRosterRow[] } {
  const { filePath, rows } = loadSalariesRosterRows();
  const byTeam: TeamRosterMap = new Map();
  for (const row of rows) {
    const arr = byTeam.get(row.teamCode) ?? [];
    // Prevent accidental duplicates from multiple lines per same team/name; keep highest salary row.
    const existingIdx = arr.findIndex((p) => p.normalizedName === row.normalizedName);
    if (existingIdx >= 0) {
      const existing = arr[existingIdx];
      const existingSalary = existing.salary ?? -1;
      const nextSalary = row.salary ?? -1;
      if (nextSalary >= existingSalary) arr[existingIdx] = row;
    } else {
      arr.push(row);
    }
    byTeam.set(row.teamCode, arr);
  }
  return { filePath, teamRoster: byTeam, players: [...byTeam.values()].flat() };
}

export { PLAYER_ALIASES };

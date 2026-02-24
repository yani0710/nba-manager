import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export function readCsvRows(fileName: string): Array<Record<string, string>> {
  const filePath = path.join(process.cwd(), "data", fileName);
  return readCsvRowsFromPath(filePath);
}

export function readCsvRowsFromPath(filePath: string): Array<Record<string, string>> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found: ${filePath}`);
  }
  const csv = fs.readFileSync(filePath, "utf8");
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  }) as Array<Record<string, string>>;
}

export function getDataCsvFiles(): string[] {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .map((file) => path.join(dir, file));
}

export function findImpactCsvPath(): string {
  const files = getDataCsvFiles();
  for (const filePath of files) {
    const firstLine = fs.readFileSync(filePath, "utf8").split(/\r?\n/, 1)[0] ?? "";
    const header = firstLine.toLowerCase();
    if (
      header.includes("team,player,pos,min,mpg,onball%") &&
      header.includes("created_pts") &&
      header.includes("ctov%")
    ) {
      return filePath;
    }
  }
  throw new Error("Impact CSV not found in data folder by header match");
}

export function findCsvByNameOrHeader(preferredName: string, headerMatchers: string[] = []): string | null {
  const preferred = path.join(process.cwd(), "data", preferredName);
  if (fs.existsSync(preferred)) return preferred;
  for (const filePath of getDataCsvFiles()) {
    const firstLine = fs.readFileSync(filePath, "utf8").split(/\r?\n/, 1)[0] ?? "";
    const header = firstLine.toLowerCase();
    if (headerMatchers.every((m) => header.includes(m.toLowerCase()))) {
      return filePath;
    }
  }
  return null;
}

type ImportHealthEntry = {
  file: string;
  matched: number;
  unmatched: number;
  unmatchedSample?: string[];
  season?: number;
  timestamp: string;
};

type ImportHealthState = {
  selectedSeason?: number;
  lastUpdated?: string;
  files?: Record<string, ImportHealthEntry>;
};

export function writeImportHealth(fileKey: string, entry: Omit<ImportHealthEntry, "timestamp">) {
  const filePath = path.join(process.cwd(), "data", "import_health.json");
  let state: ImportHealthState = {};
  if (fs.existsSync(filePath)) {
    state = JSON.parse(fs.readFileSync(filePath, "utf8")) as ImportHealthState;
  }
  const timestamp = new Date().toISOString();
  state.files = state.files ?? {};
  state.files[fileKey] = { ...entry, timestamp };
  state.lastUpdated = timestamp;
  if (typeof entry.season === "number") state.selectedSeason = entry.season;
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
}

export function readImportHealth(): ImportHealthState {
  const filePath = path.join(process.cwd(), "data", "import_health.json");
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ImportHealthState;
}

export function normalizeName(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "'")
    .replace(/[.'`]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ");
}

export function toInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function toFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function toBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapTeamCode(raw: string): string {
  const value = (raw ?? "").toUpperCase().trim();
  if (value === "BRK") return "BKN";
  if (value === "PHO") return "PHX";
  if (value === "CHO") return "CHA";
  if (value === "GS") return "GSW";
  if (value === "SA") return "SAS";
  if (value === "NO") return "NOP";
  if (value === "NY") return "NYK";
  return value;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

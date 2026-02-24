import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

type BalldontlieTeam = {
  id: number;
  abbreviation: string;
  conference: string;
  division: string;
  city: string;
  name: string;
};

type BalldontliePlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  jersey_number: string | null;
  team: BalldontlieTeam | null;
};

type BalldontlieContract = {
  id: number;
  player: {
    id: number;
    first_name: string;
    last_name: string;
  };
  salary: string | null;
  season: number | null;
};

type PagedResponse<T> = {
  data: T[];
  meta?: {
    next_cursor?: number | null;
    per_page?: number;
  };
};

type SeedPlayer = {
  nbaPlayerId: number;
  firstName: string;
  lastName: string;
  number: number | null;
  position: string;
  birthDate?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  nationality?: string | null;
  teamShortName: string;
  isActive: boolean;
};

type SeedContract = {
  playerName: string;
  contractType: string;
  startYear: number;
  endYear: number;
  totalValue: number;
  guaranteedValue: number;
  annualValue: number;
  currentYearSalary: number;
  years: Array<{
    season: string;
    salary: number;
    guaranteed: boolean;
  }>;
};

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = process.env.BALLDONTLIE_API_KEY;
const NBA_SEASON = Number(process.env.NBA_SEASON ?? "2025");
const NBA_DATA_SEASON = process.env.NBA_DATA_SEASON ?? `${NBA_SEASON}-${String((NBA_SEASON + 1) % 100).padStart(2, "0")}`;
const NBA_IMPORT_START_CURSOR = Number(process.env.NBA_IMPORT_START_CURSOR ?? "0");
const NBA_IMPORT_MAX_PAGES = Number(process.env.NBA_IMPORT_MAX_PAGES ?? "4");
const DATA_DIR = path.resolve(__dirname, "..", "prisma", "data");

if (!API_KEY) {
  throw new Error("Missing BALLDONTLIE_API_KEY in apps/api/.env");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: API_KEY,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}): ${url}\n${body}`);
  }

  return (await response.json()) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageWithRetry<T>(url: string, retries = 6): Promise<PagedResponse<T>> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fetchJson<PagedResponse<T>>(url);
    } catch (error) {
      const message = String(error);
      if (message.includes("429")) {
        const backoffMs = 1500 * (attempt + 1);
        console.warn(`Rate limited. Waiting ${backoffMs}ms before retry...`);
        await sleep(backoffMs);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Rate limit retries exceeded for ${url}`);
}

async function fetchAllPages<T>(
  endpoint: string,
  params: Record<string, string> = {},
  options: { maxPages?: number; delayMs?: number; startCursor?: number } = {},
): Promise<T[]> {
  const maxPages = options.maxPages ?? 50;
  const delayMs = options.delayMs ?? 1000;
  let cursor: number | null | undefined = options.startCursor && options.startCursor > 0 ? options.startCursor : null;
  const results: T[] = [];
  let pageCount = 0;

  do {
    const query = new URLSearchParams({
      ...params,
      per_page: "100",
    });

    if (cursor) {
      query.set("cursor", String(cursor));
    }

    const url = `${API_BASE}${endpoint}?${query.toString()}`;
    let page: PagedResponse<T>;
    try {
      page = await fetchPageWithRetry<T>(url);
    } catch (error) {
      const message = String(error);
      if (message.includes("Rate limit retries exceeded") && results.length > 0) {
        console.warn("Rate limit ceiling reached. Continuing with partial import.");
        break;
      }
      throw error;
    }
    results.push(...page.data);
    cursor = page.meta?.next_cursor ?? null;
    pageCount += 1;
    if (pageCount >= maxPages) {
      break;
    }
    if (cursor) {
      await sleep(delayMs);
    }
  } while (cursor);

  return results;
}

function normalizeTeamShortName(shortName: string): string {
  if (shortName === "BRK") return "BKN";
  return shortName;
}

function normalizePosition(position: string): string {
  if (!position || position.trim() === "") return "N/A";
  return position.toUpperCase();
}

function toIntMoney(value: string | null): number {
  if (!value) return 0;
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.round(num);
}

async function loadTeamsByAbbreviation(): Promise<Map<number, string>> {
  const teams = await fetchAllPages<BalldontlieTeam>("/teams");
  return new Map(
    teams
      .filter((team) => team.id >= 1 && team.id <= 30)
      .map((team) => [team.id, normalizeTeamShortName(team.abbreviation)]),
  );
}

async function buildPlayersFile(): Promise<SeedPlayer[]> {
  const teamsById = await loadTeamsByAbbreviation();
  const activePlayers = await fetchAllPages<BalldontliePlayer>(
    "/players",
    { active: "true" },
    { maxPages: NBA_IMPORT_MAX_PAGES, delayMs: 1200, startCursor: NBA_IMPORT_START_CURSOR },
  );
  const players = activePlayers
    .filter((player) => player.team?.id && teamsById.has(player.team.id))
    .map((player) => {
      const jersey = player.jersey_number ? Number(player.jersey_number) : null;
      return {
        nbaPlayerId: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        number: Number.isNaN(jersey as number) ? null : jersey,
        position: normalizePosition(player.position),
        teamShortName: teamsById.get(player.team!.id)!,
        isActive: true,
      };
    });

  const deduped = new Map<number, SeedPlayer>();
  for (const player of players) {
    deduped.set(player.nbaPlayerId, player);
  }
  return [...deduped.values()];
}

function buildFallbackContracts(players: SeedPlayer[]): SeedContract[] {
  return players.map((player) => {
    const idScore = player.nbaPlayerId % 100;
    const band = Math.max(2, Math.min(45, Math.round(idScore * 0.45)));
    const annualValue = band * 1_000_000;
    const seasonStart = NBA_SEASON;
    const seasonEnd = NBA_SEASON + 1;
    return {
      playerName: `${player.firstName} ${player.lastName}`,
      contractType: "GeneratedFallback",
      startYear: seasonStart,
      endYear: seasonEnd,
      totalValue: annualValue,
      guaranteedValue: annualValue,
      annualValue,
      currentYearSalary: annualValue,
      years: [
        {
          season: `${seasonStart}-${String((seasonStart + 1) % 100).padStart(2, "0")}`,
          salary: annualValue,
          guaranteed: true,
        },
      ],
    };
  });
}

async function buildContractsFile(players: SeedPlayer[]): Promise<SeedContract[]> {
  let teamsById: Map<number, string>;
  try {
    teamsById = await loadTeamsByAbbreviation();
  } catch (error) {
    const message = String(error);
    if (message.includes("Rate limit") || message.includes("429") || message.includes("401") || message.includes("403") || message.includes("402")) {
      console.warn("Contracts import unavailable right now. Generating fallback contracts.");
      return buildFallbackContracts(players);
    }
    throw error;
  }
  const contracts: SeedContract[] = [];

  // Contracts endpoint can be unavailable depending on account plan.
  for (const [teamId] of teamsById) {
    const url = `${API_BASE}/contracts?team_ids[]=${teamId}&seasons[]=${NBA_SEASON}&per_page=100`;
    let page: PagedResponse<BalldontlieContract>;
    try {
      page = await fetchJson<PagedResponse<BalldontlieContract>>(url);
    } catch (error) {
      const message = String(error);
      if (message.includes("403") || message.includes("402") || message.includes("401")) {
        console.warn("Contracts endpoint is not available for current API key plan. Generating fallback contracts.");
        return buildFallbackContracts(players);
      }
      throw error;
    }

    for (const contract of page.data) {
      const salary = toIntMoney(contract.salary);
      const playerName = `${contract.player.first_name} ${contract.player.last_name}`;
      contracts.push({
        playerName,
        contractType: "Standard",
        startYear: contract.season ?? NBA_SEASON,
        endYear: (contract.season ?? NBA_SEASON) + 1,
        totalValue: salary,
        guaranteedValue: salary,
        annualValue: salary,
        currentYearSalary: salary,
        years: [
          {
            season: `${contract.season ?? NBA_SEASON}-${String(((contract.season ?? NBA_SEASON) + 1) % 100).padStart(2, "0")}`,
            salary,
            guaranteed: true,
          },
        ],
      });
    }
  }

  const byPlayer = new Map<string, SeedContract>();
  for (const contract of contracts) {
    byPlayer.set(contract.playerName.toLowerCase(), contract);
  }
  const importedContracts = [...byPlayer.values()];
  if (importedContracts.length === 0) {
    return buildFallbackContracts(players);
  }
  return importedContracts;
}

function writeJsonFile(fileName: string, data: unknown): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(DATA_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJsonFile<T>(fileName: string): T[] {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T[];
}

function mergePlayers(existing: SeedPlayer[], incoming: SeedPlayer[]): SeedPlayer[] {
  const byId = new Map<number, SeedPlayer>();
  for (const player of existing) byId.set(player.nbaPlayerId, player);
  for (const player of incoming) {
    const prev = byId.get(player.nbaPlayerId);
    byId.set(player.nbaPlayerId, {
      ...prev,
      ...player,
      birthDate: player.birthDate ?? prev?.birthDate,
      heightCm: player.heightCm ?? prev?.heightCm ?? null,
      weightKg: player.weightKg ?? prev?.weightKg ?? null,
      nationality: player.nationality ?? prev?.nationality ?? null,
    });
  }
  return [...byId.values()];
}

function mergeContracts(existing: SeedContract[], incoming: SeedContract[]): SeedContract[] {
  const byName = new Map<string, SeedContract>();
  for (const contract of existing) byName.set(contract.playerName.toLowerCase(), contract);
  for (const contract of incoming) byName.set(contract.playerName.toLowerCase(), contract);
  return [...byName.values()];
}

async function main() {
  console.log(`Importing NBA data for season ${NBA_DATA_SEASON}...`);

  const playersFileName = `players.nba.${NBA_DATA_SEASON}.json`;
  const contractsFileName = `contracts.nba.${NBA_DATA_SEASON}.json`;
  const existingPlayers = readJsonFile<SeedPlayer>(playersFileName);
  const incomingPlayers = await buildPlayersFile();
  const players = mergePlayers(existingPlayers, incomingPlayers);
  writeJsonFile(playersFileName, players);
  console.log(`Saved ${players.length} players (added ${incomingPlayers.length} from this run).`);

  const existingContracts = readJsonFile<SeedContract>(contractsFileName);
  const incomingContracts = await buildContractsFile(players);
  const contracts = mergeContracts(existingContracts, incomingContracts);
  writeJsonFile(contractsFileName, contracts);
  console.log(`Saved ${contracts.length} contracts (added ${incomingContracts.length} from this run).`);

  console.log("Import completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

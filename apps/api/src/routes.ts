import fs from "node:fs";
import path from "node:path";
import savesRoutes from "./modules/saves/saves.routes";
import teamsRoutes from "./modules/teams/teams.routes";
import playersRoutes from "./modules/players/players.routes";
import gamesRoutes from "./modules/games/games.routes";
import coachesRoutes from "./modules/coaches/coaches.routes";
import prisma from "./config/prisma";
import { enrichPlayersFromSalariesRoster } from "./data/enrichPlayers";

function readImportHealthLocal() {
  const filePath = path.resolve(__dirname, "..", "data", "import_health.json");
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      selectedSeason?: number;
      lastUpdated?: string;
      files?: Record<string, { unmatchedSample?: string[] } & Record<string, unknown>>;
    };
  } catch {
    return {};
  }
}

function readRatingsStateLocal() {
  const filePath = path.resolve(__dirname, "..", "data", "ratings_state.json");
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function setupRoutes(app: any): void {
  // Health check
  app.get("/health", (req: any, res: any) => {
    res.json({ status: "ok" });
  });

  app.get("/api/debug/import-health", async (req: any, res: any, next: any) => {
    try {
      const health = readImportHealthLocal();
      const selectedSeason = health.selectedSeason ?? null;
      const [advancedCount, impactCount, activePlayers, curryRows] = await Promise.all([
        selectedSeason ? prisma.playerSeasonAdvanced.count({ where: { season: selectedSeason } }) : prisma.playerSeasonAdvanced.count(),
        selectedSeason ? prisma.playerSeasonImpact.count({ where: { season: selectedSeason } }) : prisma.playerSeasonImpact.count(),
        prisma.player.count({ where: { active: true } }),
        prisma.player.findMany({
          where: { name: { in: ["Stephen Curry", "Seth Curry"] } },
          select: {
            id: true,
            name: true,
            externalRef: true,
            seasonImpact: selectedSeason
              ? { where: { season: selectedSeason }, select: { season: true, teamCode: true } }
              : { take: 1, orderBy: { season: "desc" }, select: { season: true, teamCode: true } },
          },
        }),
      ]);

      const curryCheck = ["Stephen Curry", "Seth Curry"].map((name) => {
        const row = curryRows.find((p) => p.name === name);
        if (!row) return { name, status: "no_player_match" };
        if (!row.seasonImpact?.length) return { name, status: "no_season_impact", externalRef: row.externalRef ?? null };
        return {
          name,
          status: "ok",
          externalRef: row.externalRef ?? null,
          season: row.seasonImpact[0].season,
          teamCode: row.seasonImpact[0].teamCode,
        };
      });

      res.json({
        selectedSeason,
        counts: {
          activePlayers,
          playerSeasonAdvanced: advancedCount,
          playerSeasonImpact: impactCount,
        },
        imports: health.files ?? {},
        lastImportTimestamp: health.lastUpdated ?? null,
        unmatchedPlayers: Object.fromEntries(
          Object.entries(health.files ?? {}).map(([k, v]) => [k, v.unmatchedSample ?? []]),
        ),
        curryCheck,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/meta/ratings-state", (req: any, res: any) => {
    const state = readRatingsStateLocal() as {
      lastRatingsRecalcAt?: string;
      seasonUsed?: number;
      playersUpdated?: number;
      averageOverall?: number;
    };
    res.json({
      lastRatingsRecalcAt: state.lastRatingsRecalcAt ?? null,
      seasonUsed: state.seasonUsed ?? null,
      numberOfPlayersUpdated: state.playersUpdated ?? null,
      averageOverall: state.averageOverall ?? null,
    });
  });

  app.get("/api/debug/salaries-roster-health", async (req: any, res: any, next: any) => {
    try {
      const roster = await enrichPlayersFromSalariesRoster();
      res.json({
        source: "nba_salaries_clean.csv",
        ...roster.health,
        perTeamMissing: Object.fromEntries(
          [...roster.byTeam.entries()].map(([teamCode, players]) => [
            teamCode,
            {
              total: players.length,
              missing: players.filter((p) => !p.enrichmentMatched).length,
            },
          ]),
        ),
      });
    } catch (err) {
      next(err);
    }
  });

  // API Routes
  app.use("/api/saves", savesRoutes);
  app.use("/api/coaches", coachesRoutes);
  app.use("/api/teams", teamsRoutes);
  app.use("/api/players", playersRoutes);
  app.use("/api/games", gamesRoutes);
}

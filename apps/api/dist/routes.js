"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const saves_routes_1 = __importDefault(require("./modules/saves/saves.routes"));
const teams_routes_1 = __importDefault(require("./modules/teams/teams.routes"));
const players_routes_1 = __importDefault(require("./modules/players/players.routes"));
const games_routes_1 = __importDefault(require("./modules/games/games.routes"));
const coaches_routes_1 = __importDefault(require("./modules/coaches/coaches.routes"));
const trades_routes_1 = __importDefault(require("./modules/trades/trades.routes"));
const prisma_1 = __importDefault(require("./config/prisma"));
const enrichPlayers_1 = require("./data/enrichPlayers");
function readImportHealthLocal() {
    const filePath = node_path_1.default.resolve(__dirname, "..", "data", "import_health.json");
    if (!node_fs_1.default.existsSync(filePath))
        return {};
    try {
        return JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
    }
    catch {
        return {};
    }
}
function readRatingsStateLocal() {
    const filePath = node_path_1.default.resolve(__dirname, "..", "data", "ratings_state.json");
    if (!node_fs_1.default.existsSync(filePath))
        return {};
    try {
        return JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
    }
    catch {
        return {};
    }
}
function setupRoutes(app) {
    // Health check
    app.get("/health", (req, res) => {
        res.json({ status: "ok" });
    });
    app.get("/api/debug/import-health", async (req, res, next) => {
        try {
            const health = readImportHealthLocal();
            const selectedSeason = health.selectedSeason ?? null;
            const [advancedCount, impactCount, activePlayers, curryRows] = await Promise.all([
                selectedSeason ? prisma_1.default.playerSeasonAdvanced.count({ where: { season: selectedSeason } }) : prisma_1.default.playerSeasonAdvanced.count(),
                selectedSeason ? prisma_1.default.playerSeasonImpact.count({ where: { season: selectedSeason } }) : prisma_1.default.playerSeasonImpact.count(),
                prisma_1.default.player.count({ where: { active: true } }),
                prisma_1.default.player.findMany({
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
                if (!row)
                    return { name, status: "no_player_match" };
                if (!row.seasonImpact?.length)
                    return { name, status: "no_season_impact", externalRef: row.externalRef ?? null };
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
                unmatchedPlayers: Object.fromEntries(Object.entries(health.files ?? {}).map(([k, v]) => [k, v.unmatchedSample ?? []])),
                curryCheck,
            });
        }
        catch (err) {
            next(err);
        }
    });
    app.get("/api/meta/ratings-state", (req, res) => {
        const state = readRatingsStateLocal();
        res.json({
            lastRatingsRecalcAt: state.lastRatingsRecalcAt ?? null,
            seasonUsed: state.seasonUsed ?? null,
            numberOfPlayersUpdated: state.playersUpdated ?? null,
            averageOverall: state.averageOverall ?? null,
        });
    });
    app.get("/api/debug/salaries-roster-health", async (req, res, next) => {
        try {
            const roster = await (0, enrichPlayers_1.enrichPlayersFromSalariesRoster)();
            res.json({
                source: "nba_salaries_clean.csv",
                ...roster.health,
                perTeamMissing: Object.fromEntries([...roster.byTeam.entries()].map(([teamCode, players]) => [
                    teamCode,
                    {
                        total: players.length,
                        missing: players.filter((p) => !p.enrichmentMatched).length,
                    },
                ])),
            });
        }
        catch (err) {
            next(err);
        }
    });
    // API Routes
    app.use("/api/saves", saves_routes_1.default);
    app.use("/api/coaches", coaches_routes_1.default);
    app.use("/api/teams", teams_routes_1.default);
    app.use("/api/players", players_routes_1.default);
    app.use("/api/games", games_routes_1.default);
    app.use("/api/transfers", trades_routes_1.default);
}
//# sourceMappingURL=routes.js.map
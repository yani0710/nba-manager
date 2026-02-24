"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayersController = void 0;
const players_service_1 = require("./players.service");
const AppError_1 = require("../../common/errors/AppError");
const playersService = new players_service_1.PlayersService();
class PlayersController {
    async getAll(req, res, next) {
        try {
            const take = req.query.take ? Number(req.query.take) : undefined;
            const includeInactive = String(req.query.includeInactive ?? "false").toLowerCase() === "true";
            const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
            const players = await playersService.getAllPlayers(take, includeInactive, saveId);
            res.json(players);
        }
        catch (err) {
            next(err);
        }
    }
    async getById(req, res, next) {
        try {
            const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
            const player = await playersService.getPlayerById(Number(req.params.id), saveId);
            if (!player) {
                throw new AppError_1.NotFoundError("Player");
            }
            res.json(player);
        }
        catch (err) {
            next(err);
        }
    }
    async getByTeamId(req, res, next) {
        try {
            const includeInactive = String(req.query.includeInactive ?? "false").toLowerCase() === "true";
            const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
            const players = await playersService.getPlayersByTeamId(Number(req.params.teamId), includeInactive, saveId);
            res.json(players);
        }
        catch (err) {
            next(err);
        }
    }
    async getStats(req, res, next) {
        try {
            const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
            const stats = await playersService.getPlayerStats(Number(req.params.id), saveId);
            res.json(stats);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.PlayersController = PlayersController;
//# sourceMappingURL=players.controller.js.map
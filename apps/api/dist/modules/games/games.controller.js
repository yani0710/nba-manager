"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesController = void 0;
const games_service_1 = require("./games.service");
const AppError_1 = require("../../common/errors/AppError");
const gamesService = new games_service_1.GamesService();
class GamesController {
    async getAll(req, res, next) {
        try {
            const games = await gamesService.getAllGames();
            res.json(games);
        }
        catch (err) {
            next(err);
        }
    }
    async getById(req, res, next) {
        try {
            const game = await gamesService.getGameById(Number(req.params.id));
            if (!game) {
                throw new AppError_1.NotFoundError("Game");
            }
            res.json(game);
        }
        catch (err) {
            next(err);
        }
    }
    async getUpcoming(req, res, next) {
        try {
            const limit = req.query.limit ? Number(req.query.limit) : 10;
            const games = await gamesService.getUpcomingGames(limit);
            res.json(games);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.GamesController = GamesController;
//# sourceMappingURL=games.controller.js.map
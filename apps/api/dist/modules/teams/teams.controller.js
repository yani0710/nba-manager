"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsController = void 0;
const teams_service_1 = require("./teams.service");
const AppError_1 = require("../../common/errors/AppError");
const teamsService = new teams_service_1.TeamsService();
class TeamsController {
    async getAll(req, res, next) {
        try {
            const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
            const teams = await teamsService.getAllTeams(saveId);
            res.json(teams);
        }
        catch (err) {
            next(err);
        }
    }
    async getById(req, res, next) {
        try {
            const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
            const team = await teamsService.getTeamById(Number(req.params.id), saveId);
            if (!team) {
                throw new AppError_1.NotFoundError("Team");
            }
            res.json(team);
        }
        catch (err) {
            next(err);
        }
    }
    async getRoster(req, res, next) {
        try {
            const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
            const team = await teamsService.getRosterByTeamId(Number(req.params.id), saveId);
            if (!team) {
                throw new AppError_1.NotFoundError("Team");
            }
            res.json(team);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.TeamsController = TeamsController;
//# sourceMappingURL=teams.controller.js.map
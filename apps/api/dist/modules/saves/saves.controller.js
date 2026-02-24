"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavesController = void 0;
const saves_service_1 = require("./saves.service");
const savesService = new saves_service_1.SavesService();
class SavesController {
    async create(req, res, next) {
        try {
            const save = await savesService.createSave(req.body);
            res.status(201).json(save);
        }
        catch (err) {
            next(err);
        }
    }
    async getById(req, res, next) {
        try {
            const save = await savesService.getSaveCoreState(Number(req.params.id));
            res.json(save);
        }
        catch (err) {
            next(err);
        }
    }
    async getAll(req, res, next) {
        try {
            const saves = await savesService.getAllSaves();
            res.json(saves);
        }
        catch (err) {
            next(err);
        }
    }
    async advance(req, res, next) {
        try {
            const targetDate = typeof req.body?.targetDate === "string" ? req.body.targetDate : undefined;
            const save = targetDate
                ? await savesService.advanceSaveToDate(Number(req.params.id), targetDate)
                : await savesService.advanceSave(Number(req.params.id));
            res.json(save);
        }
        catch (err) {
            next(err);
        }
    }
    async getDashboard(req, res, next) {
        try {
            const data = await savesService.getDashboardSummary(Number(req.params.id));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async getInbox(req, res, next) {
        try {
            const take = typeof req.query.take === "string" ? Number(req.query.take) : undefined;
            const skip = typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;
            const data = await savesService.getInbox(Number(req.params.id), take, skip);
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async getSchedule(req, res, next) {
        try {
            const from = typeof req.query.from === "string" ? req.query.from : undefined;
            const to = typeof req.query.to === "string" ? req.query.to : undefined;
            const data = await savesService.getSchedule(Number(req.params.id), from, to);
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async getStandings(req, res, next) {
        try {
            const data = await savesService.getStandings(Number(req.params.id));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async getNextMatch(req, res, next) {
        try {
            const data = await savesService.getNextMatchScouting(Number(req.params.id));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async getResults(req, res, next) {
        try {
            const data = await savesService.getResults(Number(req.params.id));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async getResultDetails(req, res, next) {
        try {
            const data = await savesService.getResultDetails(Number(req.params.id), Number(req.params.gameId));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async markInboxRead(req, res, next) {
        try {
            const data = await savesService.markInboxMessageRead(Number(req.params.id), Number(req.params.msgId));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async deleteInboxMessage(req, res, next) {
        try {
            const data = await savesService.deleteInboxMessage(Number(req.params.id), Number(req.params.msgId));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async saveRotation(req, res, next) {
        try {
            const data = await savesService.saveRotation(Number(req.params.id), req.body?.rotation ?? {});
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async saveTactics(req, res, next) {
        try {
            const data = await savesService.saveTactics(Number(req.params.id), req.body?.tactics ?? {});
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async saveTraining(req, res, next) {
        try {
            const data = await savesService.saveTrainingPlan(Number(req.params.id), {
                trainingPlan: req.body?.trainingPlan ?? {},
                weekPlan: req.body?.weekPlan,
                playerPlans: req.body?.playerPlans,
            });
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async getTraining(req, res, next) {
        try {
            const data = await savesService.getTrainingConfig(Number(req.params.id));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async getPlayerTrainingPlans(req, res, next) {
        try {
            const data = await savesService.getPlayerTrainingPlans(Number(req.params.id));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async upsertPlayerTrainingPlan(req, res, next) {
        try {
            const data = await savesService.upsertPlayerTrainingPlan(Number(req.params.id), {
                playerId: Number(req.body?.playerId),
                focus: String(req.body?.focus ?? "BALANCED"),
                intensity: String(req.body?.intensity ?? "BALANCED"),
            });
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async deletePlayerTrainingPlan(req, res, next) {
        try {
            const data = await savesService.deletePlayerTrainingPlan(Number(req.params.id), Number(req.params.playerId));
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
    async delete(req, res, next) {
        try {
            await savesService.deleteSave(Number(req.params.id));
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SavesController = SavesController;
//# sourceMappingURL=saves.controller.js.map
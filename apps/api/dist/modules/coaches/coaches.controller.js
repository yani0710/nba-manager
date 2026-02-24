"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoachesController = void 0;
const coaches_service_1 = require("./coaches.service");
const coachesService = new coaches_service_1.CoachesService();
class CoachesController {
    async getPresets(req, res, next) {
        try {
            const presets = coachesService.getPresets();
            res.json(presets);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.CoachesController = CoachesController;
//# sourceMappingURL=coaches.controller.js.map
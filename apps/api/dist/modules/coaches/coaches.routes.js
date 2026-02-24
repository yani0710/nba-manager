"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const coaches_controller_1 = require("./coaches.controller");
const router = (0, express_1.Router)();
const controller = new coaches_controller_1.CoachesController();
router.get("/presets", (req, res, next) => controller.getPresets(req, res, next));
exports.default = router;
//# sourceMappingURL=coaches.routes.js.map
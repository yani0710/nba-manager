"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teams_controller_1 = require("./teams.controller");
const router = (0, express_1.Router)();
const controller = new teams_controller_1.TeamsController();
router.get("/", (req, res, next) => controller.getAll(req, res, next));
router.get("/:id/roster", (req, res, next) => controller.getRoster(req, res, next));
router.get("/:id", (req, res, next) => controller.getById(req, res, next));
exports.default = router;
//# sourceMappingURL=teams.routes.js.map
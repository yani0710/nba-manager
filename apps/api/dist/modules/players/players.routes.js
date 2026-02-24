"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const players_controller_1 = require("./players.controller");
const router = (0, express_1.Router)();
const controller = new players_controller_1.PlayersController();
router.get("/", (req, res, next) => controller.getAll(req, res, next));
router.get("/team/:teamId", (req, res, next) => controller.getByTeamId(req, res, next));
router.get("/:id/stats", (req, res, next) => controller.getStats(req, res, next));
router.get("/:id", (req, res, next) => controller.getById(req, res, next));
exports.default = router;
//# sourceMappingURL=players.routes.js.map
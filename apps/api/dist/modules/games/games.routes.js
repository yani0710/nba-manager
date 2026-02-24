"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const games_controller_1 = require("./games.controller");
const router = (0, express_1.Router)();
const controller = new games_controller_1.GamesController();
router.get("/", (req, res, next) => controller.getAll(req, res, next));
router.get("/upcoming", (req, res, next) => controller.getUpcoming(req, res, next));
router.get("/:id", (req, res, next) => controller.getById(req, res, next));
exports.default = router;
//# sourceMappingURL=games.routes.js.map
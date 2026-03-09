"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const trades_controller_1 = require("./trades.controller");
const router = (0, express_1.Router)();
const controller = new trades_controller_1.TradesController();
router.get("/", (req, res, next) => controller.list(req, res, next));
router.post("/", (req, res, next) => controller.create(req, res, next));
router.post("/:id/send", (req, res, next) => controller.send(req, res, next));
router.post("/proposals/:proposalId/respond", (req, res, next) => controller.respondToProposal(req, res, next));
exports.default = router;
//# sourceMappingURL=trades.routes.js.map
import { Router } from "express";
import { TradesController } from "./trades.controller";

const router = Router();
const controller = new TradesController();

router.get("/", (req, res, next) => controller.list(req, res, next));
router.post("/", (req, res, next) => controller.create(req, res, next));
router.post("/:id/send", (req, res, next) => controller.send(req, res, next));
router.post("/proposals/:proposalId/respond", (req, res, next) => controller.respondToProposal(req, res, next));

export default router;

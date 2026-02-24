import { Router } from "express";
import { PlayersController } from "./players.controller";

const router = Router();
const controller = new PlayersController();

router.get("/", (req, res, next) => controller.getAll(req, res, next));
router.get("/team/:teamId", (req, res, next) => controller.getByTeamId(req, res, next));
router.get("/:id/stats", (req, res, next) => controller.getStats(req, res, next));
router.get("/:id", (req, res, next) => controller.getById(req, res, next));

export default router;

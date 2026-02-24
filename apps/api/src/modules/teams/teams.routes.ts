import { Router } from "express";
import { TeamsController } from "./teams.controller";

const router = Router();
const controller = new TeamsController();

router.get("/", (req, res, next) => controller.getAll(req, res, next));
router.get("/:id/roster", (req, res, next) => controller.getRoster(req, res, next));
router.get("/:id", (req, res, next) => controller.getById(req, res, next));

export default router;

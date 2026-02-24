import { Router } from "express";
import { GamesController } from "./games.controller";

const router = Router();
const controller = new GamesController();

router.get("/", (req, res, next) => controller.getAll(req, res, next));
router.get("/upcoming", (req, res, next) => controller.getUpcoming(req, res, next));
router.get("/:id", (req, res, next) => controller.getById(req, res, next));

export default router;

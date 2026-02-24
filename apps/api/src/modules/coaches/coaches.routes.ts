import { Router } from "express";
import { CoachesController } from "./coaches.controller";

const router = Router();
const controller = new CoachesController();

router.get("/presets", (req, res, next) => controller.getPresets(req, res, next));

export default router;

import { Router } from "express";
import { SavesController } from "./saves.controller";

const router = Router();
const controller = new SavesController();

router.post("/", (req, res, next) => controller.create(req, res, next));
router.get("/", (req, res, next) => controller.getAll(req, res, next));
router.get("/:id", (req, res, next) => controller.getById(req, res, next));
router.get("/:id/dashboard", (req, res, next) => controller.getDashboard(req, res, next));
router.get("/:id/schedule", (req, res, next) => controller.getSchedule(req, res, next));
router.get("/:id/standings", (req, res, next) => controller.getStandings(req, res, next));
router.get("/:id/next-match", (req, res, next) => controller.getNextMatch(req, res, next));
router.get("/:id/results", (req, res, next) => controller.getResults(req, res, next));
router.get("/:id/results/:gameId", (req, res, next) => controller.getResultDetails(req, res, next));
router.get("/:id/inbox", (req, res, next) => controller.getInbox(req, res, next));
router.post("/:id/inbox/:msgId/read", (req, res, next) => controller.markInboxRead(req, res, next));
router.post("/:id/inbox/:msgId/respond", (req, res, next) => controller.respondInboxMessage(req, res, next));
router.delete("/:id/inbox/:msgId", (req, res, next) => controller.deleteInboxMessage(req, res, next));
router.post("/:id/rotation", (req, res, next) => controller.saveRotation(req, res, next));
router.post("/:id/tactics", (req, res, next) => controller.saveTactics(req, res, next));
router.get("/:id/training", (req, res, next) => controller.getTraining(req, res, next));
router.post("/:id/training", (req, res, next) => controller.saveTraining(req, res, next));
router.post("/:id/roster-management", (req, res, next) => controller.saveRosterManagement(req, res, next));
router.get("/:id/training/players", (req, res, next) => controller.getPlayerTrainingPlans(req, res, next));
router.post("/:id/training/players", (req, res, next) => controller.upsertPlayerTrainingPlan(req, res, next));
router.delete("/:id/training/players/:playerId", (req, res, next) => controller.deletePlayerTrainingPlan(req, res, next));
router.post("/:id/advance", (req, res, next) => controller.advance(req, res, next));
router.delete("/:id", (req, res, next) => controller.delete(req, res, next));

export default router;

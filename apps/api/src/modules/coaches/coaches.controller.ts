import { Request, Response, NextFunction } from "express";
import { CoachesService } from "./coaches.service";

const coachesService = new CoachesService();

export class CoachesController {
  async getPresets(req: Request, res: Response, next: NextFunction) {
    try {
      const presets = coachesService.getPresets();
      res.json(presets);
    } catch (err) {
      next(err);
    }
  }
}

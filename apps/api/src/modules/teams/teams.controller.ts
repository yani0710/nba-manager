import { Request, Response, NextFunction } from "express";
import { TeamsService } from "./teams.service";
import { NotFoundError } from "../../common/errors/AppError";

const teamsService = new TeamsService();

export class TeamsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
      const teams = await teamsService.getAllTeams(saveId);
      res.json(teams);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
      const team = await teamsService.getTeamById(Number(req.params.id), saveId);
      if (!team) {
        throw new NotFoundError("Team");
      }
      res.json(team);
    } catch (err) {
      next(err);
    }
  }

  async getRoster(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
      const team = await teamsService.getRosterByTeamId(Number(req.params.id), saveId);
      if (!team) {
        throw new NotFoundError("Team");
      }
      res.json(team);
    } catch (err) {
      next(err);
    }
  }
}

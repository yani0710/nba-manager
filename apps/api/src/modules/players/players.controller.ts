import { Request, Response, NextFunction } from "express";
import { PlayersService } from "./players.service";
import { NotFoundError } from "../../common/errors/AppError";

const playersService = new PlayersService();

export class PlayersController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const take = req.query.take ? Number(req.query.take) : undefined;
      const includeInactive = String(req.query.includeInactive ?? "false").toLowerCase() === "true";
      const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
      const players = await playersService.getAllPlayers(take, includeInactive, saveId);
      res.json(players);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
      const player = await playersService.getPlayerById(Number(req.params.id), saveId);
      if (!player) {
        throw new NotFoundError("Player");
      }
      res.json(player);
    } catch (err) {
      next(err);
    }
  }

  async getByTeamId(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = String(req.query.includeInactive ?? "false").toLowerCase() === "true";
      const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
      const players = await playersService.getPlayersByTeamId(Number(req.params.teamId), includeInactive, saveId);
      res.json(players);
    } catch (err) {
      next(err);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = req.query.saveId ? Number(req.query.saveId) : undefined;
      const stats = await playersService.getPlayerStats(Number(req.params.id), saveId);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
}

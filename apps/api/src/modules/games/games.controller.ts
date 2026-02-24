import { Request, Response, NextFunction } from "express";
import { GamesService } from "./games.service";
import { NotFoundError } from "../../common/errors/AppError";

const gamesService = new GamesService();

export class GamesController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const games = await gamesService.getAllGames();
      res.json(games);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const game = await gamesService.getGameById(Number(req.params.id));
      if (!game) {
        throw new NotFoundError("Game");
      }
      res.json(game);
    } catch (err) {
      next(err);
    }
  }

  async getUpcoming(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const games = await gamesService.getUpcomingGames(limit);
      res.json(games);
    } catch (err) {
      next(err);
    }
  }
}

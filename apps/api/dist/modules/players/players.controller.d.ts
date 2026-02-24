import { Request, Response, NextFunction } from "express";
export declare class PlayersController {
    getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    getById(req: Request, res: Response, next: NextFunction): Promise<void>;
    getByTeamId(req: Request, res: Response, next: NextFunction): Promise<void>;
    getStats(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=players.controller.d.ts.map
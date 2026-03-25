import { Request, Response, NextFunction } from "express";
export declare class SavesController {
    create(req: Request, res: Response, next: NextFunction): Promise<void>;
    getById(req: Request, res: Response, next: NextFunction): Promise<void>;
    getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    advance(req: Request, res: Response, next: NextFunction): Promise<void>;
    getDashboard(req: Request, res: Response, next: NextFunction): Promise<void>;
    getInbox(req: Request, res: Response, next: NextFunction): Promise<void>;
    getSchedule(req: Request, res: Response, next: NextFunction): Promise<void>;
    getStandings(req: Request, res: Response, next: NextFunction): Promise<void>;
    getNextMatch(req: Request, res: Response, next: NextFunction): Promise<void>;
    getResults(req: Request, res: Response, next: NextFunction): Promise<void>;
    getResultDetails(req: Request, res: Response, next: NextFunction): Promise<void>;
    markInboxRead(req: Request, res: Response, next: NextFunction): Promise<void>;
    deleteInboxMessage(req: Request, res: Response, next: NextFunction): Promise<void>;
    respondInboxMessage(req: Request, res: Response, next: NextFunction): Promise<void>;
    saveRotation(req: Request, res: Response, next: NextFunction): Promise<void>;
    saveTactics(req: Request, res: Response, next: NextFunction): Promise<void>;
    saveTraining(req: Request, res: Response, next: NextFunction): Promise<void>;
    saveRosterManagement(req: Request, res: Response, next: NextFunction): Promise<void>;
    getTraining(req: Request, res: Response, next: NextFunction): Promise<void>;
    getPlayerTrainingPlans(req: Request, res: Response, next: NextFunction): Promise<void>;
    upsertPlayerTrainingPlan(req: Request, res: Response, next: NextFunction): Promise<void>;
    deletePlayerTrainingPlan(req: Request, res: Response, next: NextFunction): Promise<void>;
    delete(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=saves.controller.d.ts.map
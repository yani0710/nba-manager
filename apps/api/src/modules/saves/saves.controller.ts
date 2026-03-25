import { Request, Response, NextFunction } from "express";
import { SavesService } from "./saves.service";

const savesService = new SavesService();

export class SavesController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const save = await savesService.createSave(req.body);
      res.status(201).json(save);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const save = await savesService.getSaveCoreState(Number(req.params.id));
      res.json(save);
    } catch (err) {
      next(err);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const saves = await savesService.getAllSaves();
      res.json(saves);
    } catch (err) {
      next(err);
    }
  }

  async advance(req: Request, res: Response, next: NextFunction) {
    try {
      const targetDate = typeof req.body?.targetDate === "string" ? req.body.targetDate : undefined;
      const includeTargetDay = req.body?.includeTargetDay === true;
      const save = targetDate
        ? await savesService.advanceSaveToDate(Number(req.params.id), targetDate, includeTargetDay)
        : await savesService.advanceSave(Number(req.params.id));
      res.json(save);
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.getDashboardSummary(Number(req.params.id));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getInbox(req: Request, res: Response, next: NextFunction) {
    try {
      const take = typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip = typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;
      const data = await savesService.getInbox(Number(req.params.id), take, skip);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const data = await savesService.getSchedule(Number(req.params.id), from, to);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getStandings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.getStandings(Number(req.params.id));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getNextMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.getNextMatchScouting(Number(req.params.id));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getResults(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.getResults(Number(req.params.id));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getResultDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.getResultDetails(Number(req.params.id), Number(req.params.gameId));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async markInboxRead(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.markInboxMessageRead(Number(req.params.id), Number(req.params.msgId));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async deleteInboxMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.deleteInboxMessage(Number(req.params.id), Number(req.params.msgId));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async respondInboxMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.respondInboxMessage(
        Number(req.params.id),
        Number(req.params.msgId),
        String(req.body?.responseId ?? ""),
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async saveRotation(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.saveRotation(Number(req.params.id), req.body?.rotation ?? {});
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async saveTactics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.saveTactics(
        Number(req.params.id),
        req.body?.tactics ?? {},
        req.body?.rotation ?? undefined,
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async saveTraining(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.saveTrainingPlan(Number(req.params.id), {
        trainingPlan: req.body?.trainingPlan ?? {},
        weekPlan: req.body?.weekPlan,
        playerPlans: req.body?.playerPlans,
        teamProfiles: req.body?.teamProfiles,
        activeTeamProfileId: req.body?.activeTeamProfileId,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async saveRosterManagement(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.saveRosterManagement(Number(req.params.id), {
        tradeBlockPlayerIds: req.body?.tradeBlockPlayerIds,
        developmentLeaguePlayerIds: req.body?.developmentLeaguePlayerIds,
        comparePlayerIds: req.body?.comparePlayerIds,
        playerRoles: req.body?.playerRoles,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getTraining(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.getTrainingConfig(Number(req.params.id));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getPlayerTrainingPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.getPlayerTrainingPlans(Number(req.params.id));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async upsertPlayerTrainingPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.upsertPlayerTrainingPlan(Number(req.params.id), {
        playerId: Number(req.body?.playerId),
        focus: String(req.body?.focus ?? "BALANCED"),
        intensity: String(req.body?.intensity ?? "BALANCED"),
        dayPlan: req.body?.dayPlan,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async deletePlayerTrainingPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await savesService.deletePlayerTrainingPlan(Number(req.params.id), Number(req.params.playerId));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await savesService.deleteSave(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

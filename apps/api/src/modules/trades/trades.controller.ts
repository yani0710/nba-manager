import { NextFunction, Request, Response } from "express";
import { TradesService } from "./trades.service";

const tradesService = new TradesService();

export class TradesController {
  async getCapSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = Number(req.query.saveId);
      const teamId = Number(req.query.teamId);
      const data = await tradesService.getCapSummary(saveId, teamId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async listContractOffers(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = Number(req.query.saveId);
      const teamId = req.query.teamId == null ? undefined : Number(req.query.teamId);
      const data = await tradesService.listContractOffers(saveId, teamId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async submitContractOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tradesService.submitContractOffer({
        saveId: Number(req.body?.saveId),
        teamId: Number(req.body?.teamId),
        playerId: Number(req.body?.playerId),
        salaryPerYear: Number(req.body?.salaryPerYear),
        years: Number(req.body?.years),
        rolePromise: String(req.body?.rolePromise ?? "rotation"),
        optionType: req.body?.optionType == null ? null : String(req.body.optionType),
        decisionDays: req.body?.decisionDays == null ? undefined : Number(req.body.decisionDays),
      });
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async withdrawContractOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tradesService.withdrawContractOffer(Number(req.body?.saveId), Number(req.params.offerId));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async listTradeProposals(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = Number(req.query.saveId);
      const data = await tradesService.listTradeProposals(saveId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async submitTradeProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tradesService.submitTradeProposal({
        saveId: Number(req.body?.saveId),
        fromTeamId: Number(req.body?.fromTeamId),
        toTeamId: Number(req.body?.toTeamId),
        outgoingPlayerIds: Array.isArray(req.body?.outgoingPlayerIds) ? req.body.outgoingPlayerIds.map(Number) : [],
        incomingPlayerIds: Array.isArray(req.body?.incomingPlayerIds) ? req.body.incomingPlayerIds.map(Number) : [],
        cashOut: req.body?.cashOut == null ? undefined : Number(req.body.cashOut),
        cashIn: req.body?.cashIn == null ? undefined : Number(req.body.cashIn),
        responseDays: req.body?.responseDays == null ? undefined : Number(req.body.responseDays),
      });
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async withdrawTradeProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tradesService.withdrawTradeProposal(Number(req.body?.saveId), Number(req.params.proposalId));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async listNegotiationEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = Number(req.query.saveId);
      const data = await tradesService.listNegotiationEvents(saveId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async listTransactionHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = Number(req.query.saveId);
      const data = await tradesService.listTransactionHistory(saveId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async listFreeAgents(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = Number(req.query.saveId);
      const data = await tradesService.listFreeAgents(saveId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async signFreeAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tradesService.signFreeAgent({
        saveId: Number(req.body?.saveId),
        toTeamId: Number(req.body?.toTeamId),
        playerId: Number(req.params.playerId),
        salary: req.body?.salary == null ? undefined : Number(req.body.salary),
        years: req.body?.years == null ? undefined : Number(req.body.years),
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const saveId = Number(req.query.saveId);
      const data = await tradesService.listOffers(saveId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tradesService.createOffer({
        saveId: Number(req.body?.saveId),
        fromTeamId: Number(req.body?.fromTeamId),
        toTeamId: Number(req.body?.toTeamId),
        outgoingPlayerIds: Array.isArray(req.body?.outgoingPlayerIds) ? req.body.outgoingPlayerIds.map(Number) : [],
        incomingPlayerIds: Array.isArray(req.body?.incomingPlayerIds) ? req.body.incomingPlayerIds.map(Number) : [],
        cashOut: req.body?.cashOut == null ? undefined : Number(req.body.cashOut),
        cashIn: req.body?.cashIn == null ? undefined : Number(req.body.cashIn),
        sellOnPct: req.body?.sellOnPct == null ? null : Number(req.body.sellOnPct),
        sendNow: Boolean(req.body?.sendNow),
      });
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async send(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tradesService.sendOffer(Number(req.body?.saveId), Number(req.params.id));
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async respondToProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tradesService.respondToPlayerProposal({
        saveId: Number(req.body?.saveId),
        proposalId: Number(req.params.proposalId),
        action: String(req.body?.action ?? "DECLINE").toUpperCase() as "ACCEPT" | "NEGOTIATE" | "DECLINE",
        proposedSalary: req.body?.proposedSalary == null ? undefined : Number(req.body.proposedSalary),
        years: req.body?.years == null ? undefined : Number(req.body.years),
        role: req.body?.role == null ? undefined : String(req.body.role),
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

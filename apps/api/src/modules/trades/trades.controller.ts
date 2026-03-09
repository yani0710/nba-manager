import { NextFunction, Request, Response } from "express";
import { TradesService } from "./trades.service";

const tradesService = new TradesService();

export class TradesController {
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

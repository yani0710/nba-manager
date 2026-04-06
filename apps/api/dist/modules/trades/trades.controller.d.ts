import { NextFunction, Request, Response } from "express";
export declare class TradesController {
    getCapSummary(req: Request, res: Response, next: NextFunction): Promise<void>;
    listContractOffers(req: Request, res: Response, next: NextFunction): Promise<void>;
    submitContractOffer(req: Request, res: Response, next: NextFunction): Promise<void>;
    withdrawContractOffer(req: Request, res: Response, next: NextFunction): Promise<void>;
    listTradeProposals(req: Request, res: Response, next: NextFunction): Promise<void>;
    submitTradeProposal(req: Request, res: Response, next: NextFunction): Promise<void>;
    withdrawTradeProposal(req: Request, res: Response, next: NextFunction): Promise<void>;
    respondTradeProposal(req: Request, res: Response, next: NextFunction): Promise<void>;
    listNegotiationEvents(req: Request, res: Response, next: NextFunction): Promise<void>;
    listTransactionHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
    listFreeAgents(req: Request, res: Response, next: NextFunction): Promise<void>;
    signFreeAgent(req: Request, res: Response, next: NextFunction): Promise<void>;
    list(req: Request, res: Response, next: NextFunction): Promise<void>;
    create(req: Request, res: Response, next: NextFunction): Promise<void>;
    send(req: Request, res: Response, next: NextFunction): Promise<void>;
    respondToProposal(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=trades.controller.d.ts.map
type CreateTransferOfferDto = {
    saveId: number;
    fromTeamId: number;
    toTeamId: number;
    outgoingPlayerIds: number[];
    incomingPlayerIds: number[];
    cashOut?: number;
    cashIn?: number;
    sellOnPct?: number | null;
    sendNow?: boolean;
};
type PlayerProposalResponseDto = {
    saveId: number;
    proposalId: number;
    action: "ACCEPT" | "NEGOTIATE" | "DECLINE";
    proposedSalary?: number;
    years?: number;
    role?: string;
};
declare function hashString(input: string): number;
declare function mulberry32(seed: number): () => number;
export declare const __transferTestUtils: {
    hashString: typeof hashString;
    mulberry32: typeof mulberry32;
};
export declare class TradesService {
    listOffers(saveId: number): Promise<{
        outgoingPlayerIds: number[];
        incomingPlayerIds: number[];
        pieceSummary: {
            outgoing: {
                id: number;
                name: string;
                position: string;
                salary: number | null;
            }[];
            incoming: {
                id: number;
                name: string;
                position: string;
                salary: number | null;
            }[];
        };
        fromTeam: {
            id: number;
            name: string;
            shortName: string;
        };
        toTeam: {
            id: number;
            name: string;
            shortName: string;
        };
        contractProposals: ({
            player: {
                id: number;
                name: string;
                position: string;
                salary: number | null;
                overallBase: number;
                overallCurrent: number;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            offerId: number;
            playerId: number;
            proposedSalary: number;
            years: number;
            role: string;
            responseDeadlineDay: number;
        })[];
        playerPieces: ({
            player: {
                id: number;
                name: string;
                position: string;
                salary: number | null;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            direction: string;
            offerId: number;
            playerId: number;
            side: string;
        })[];
        transactionLogs: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            saveId: number;
            fromTeamId: number;
            toTeamId: number;
            status: string;
            offerId: number;
            day: number;
            eventType: string;
            message: string | null;
            payload: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        fromTeamId: number;
        toTeamId: number;
        cashOut: number;
        cashIn: number;
        sellOnPct: number | null;
        status: string;
        createdDay: number;
        resolveDay: number;
        aiReason: string | null;
        resolvedAt: Date | null;
    }[]>;
    createOffer(dto: CreateTransferOfferDto): Promise<{
        fromTeam: {
            id: number;
            name: string;
            shortName: string;
        };
        toTeam: {
            id: number;
            name: string;
            shortName: string;
        };
        contractProposals: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            offerId: number;
            playerId: number;
            proposedSalary: number;
            years: number;
            role: string;
            responseDeadlineDay: number;
        }[];
        playerPieces: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            direction: string;
            offerId: number;
            playerId: number;
            side: string;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        fromTeamId: number;
        toTeamId: number;
        outgoingPlayerIds: number[];
        incomingPlayerIds: number[];
        cashOut: number;
        cashIn: number;
        sellOnPct: number | null;
        status: string;
        createdDay: number;
        resolveDay: number;
        aiReason: string | null;
        resolvedAt: Date | null;
    }>;
    sendOffer(saveId: number, offerId: number): Promise<{
        fromTeam: {
            id: number;
            name: string;
            shortName: string;
        };
        toTeam: {
            id: number;
            name: string;
            shortName: string;
        };
        contractProposals: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            offerId: number;
            playerId: number;
            proposedSalary: number;
            years: number;
            role: string;
            responseDeadlineDay: number;
        }[];
        playerPieces: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            direction: string;
            offerId: number;
            playerId: number;
            side: string;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        fromTeamId: number;
        toTeamId: number;
        outgoingPlayerIds: number[];
        incomingPlayerIds: number[];
        cashOut: number;
        cashIn: number;
        sellOnPct: number | null;
        status: string;
        createdDay: number;
        resolveDay: number;
        aiReason: string | null;
        resolvedAt: Date | null;
    }>;
    resolvePendingOffersForDay(saveId: number, day: number, date: Date): Promise<number>;
    respondToPlayerProposal(dto: PlayerProposalResponseDto): Promise<{
        success: boolean;
    }>;
    resolvePendingPlayerProposalResponsesForDay(saveId: number, day: number, date: Date): Promise<number>;
    private evaluateOffer;
    private createAgentCounterProposals;
    private evaluatePlayerContractResponse;
    private ensureSave;
    private createInboxMessage;
    private formatMoney;
    private reconcileSaveTransferState;
    private applyCompletedTransferToSaveState;
    private getOfferPlayerIdsFromPieces;
    private logTransferEvent;
}
export {};
//# sourceMappingURL=trades.service.d.ts.map
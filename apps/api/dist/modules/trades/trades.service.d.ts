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
type SignFreeAgentDto = {
    saveId: number;
    toTeamId: number;
    playerId: number;
    salary?: number;
    years?: number;
};
type SubmitContractOfferDto = {
    saveId: number;
    teamId: number;
    playerId: number;
    salaryPerYear: number;
    years: number;
    rolePromise: string;
    optionType?: string | null;
    decisionDays?: number;
};
type SubmitTradeProposalDto = {
    saveId: number;
    fromTeamId: number;
    toTeamId: number;
    outgoingPlayerIds: number[];
    incomingPlayerIds: number[];
    cashOut?: number;
    cashIn?: number;
    responseDays?: number;
};
declare function hashString(input: string): number;
declare function mulberry32(seed: number): () => number;
export declare const __transferTestUtils: {
    hashString: typeof hashString;
    mulberry32: typeof mulberry32;
};
export declare class TradesService {
    private capService;
    listFreeAgents(saveId: number): Promise<{
        position: string;
        primaryPosition: any;
        team: {
            id: number;
            name: string;
            shortName: string;
            logoPath: string | null;
        };
        number: number | null;
        id: number;
        name: string;
        externalRef: string | null;
        jerseyNumber: number | null;
        jerseyCode: string | null;
        salary: number | null;
        teamId: number;
        createdAt: Date;
        updatedAt: Date;
        firstName: string | null;
        birthDate: Date | null;
        age: number | null;
        debutYear: number | null;
        finalYear: number | null;
        school: string | null;
        hallOfFame: boolean | null;
        heightCm: number | null;
        weightKg: number | null;
        nationality: string | null;
        bioSource: string | null;
        gamesCareer: number | null;
        ptsCareer: number | null;
        trbCareer: number | null;
        astCareer: number | null;
        fgPct: number | null;
        fg3Pct: number | null;
        ftPct: number | null;
        efgPct: number | null;
        per: number | null;
        ws: number | null;
        active: boolean;
        offensiveRating: number;
        overallBase: number;
        overall: number;
        overallCurrent: number;
        defensiveRating: number;
        physicalRating: number;
        iqRating: number;
        form: number;
        morale: number;
        fatigue: number;
        formTrendDays: number;
        lastFormSnapshot: number;
        potential: number;
        handedness: string | null;
        secondaryPosition: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        lastName: string | null;
        nbaPlayerId: number | null;
    }[]>;
    getCapSummary(saveId: number, teamId: number): Promise<import("./cap.service").TeamCapSummary>;
    listContractOffers(saveId: number, teamId?: number): Promise<{
        player: {
            position: string;
            team: {
                id: number;
                name: string;
                shortName: string;
            };
            id: number;
            name: string;
            overallCurrent: number;
            potential: number;
        };
        team: {
            id: number;
            name: string;
            shortName: string;
        };
        id: number;
        teamId: number;
        createdAt: Date;
        updatedAt: Date;
        playerId: number;
        optionType: string | null;
        saveId: number;
        salaryPerYear: number;
        years: number;
        rolePromise: string;
        status: string;
        submittedDay: number;
        decisionDay: number;
        expiresDay: number | null;
        expectedSalary: number | null;
        interestScore: number | null;
        decisionReason: string | null;
        capSummary: import("@prisma/client/runtime/library").JsonValue | null;
        resolvedAt: Date | null;
    }[]>;
    submitContractOffer(dto: SubmitContractOfferDto): Promise<{
        team: {
            id: number;
            name: string;
            shortName: string;
        };
        player: {
            id: number;
            name: string;
        };
    } & {
        id: number;
        teamId: number;
        createdAt: Date;
        updatedAt: Date;
        playerId: number;
        optionType: string | null;
        saveId: number;
        salaryPerYear: number;
        years: number;
        rolePromise: string;
        status: string;
        submittedDay: number;
        decisionDay: number;
        expiresDay: number | null;
        expectedSalary: number | null;
        interestScore: number | null;
        decisionReason: string | null;
        capSummary: import("@prisma/client/runtime/library").JsonValue | null;
        resolvedAt: Date | null;
    }>;
    withdrawContractOffer(saveId: number, offerId: number): Promise<{
        id: number;
        teamId: number;
        createdAt: Date;
        updatedAt: Date;
        playerId: number;
        optionType: string | null;
        saveId: number;
        salaryPerYear: number;
        years: number;
        rolePromise: string;
        status: string;
        submittedDay: number;
        decisionDay: number;
        expiresDay: number | null;
        expectedSalary: number | null;
        interestScore: number | null;
        decisionReason: string | null;
        capSummary: import("@prisma/client/runtime/library").JsonValue | null;
        resolvedAt: Date | null;
    }>;
    listTradeProposals(saveId: number): Promise<{
        items: (({
            player: {
                id: number;
                name: string;
                position: string;
                salary: number | null;
                overallCurrent: number;
                potential: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            playerId: number | null;
            proposalId: number;
            itemType: string;
            direction: string;
            pickYear: number | null;
            pickRound: number | null;
            cashAmount: number | null;
        }) | {
            player: {
                position: string;
                primaryPosition: any;
                id: number;
                name: string;
                salary: number | null;
                overallCurrent: number;
                potential: number;
            };
            id: number;
            createdAt: Date;
            updatedAt: Date;
            playerId: number | null;
            proposalId: number;
            itemType: string;
            direction: string;
            pickYear: number | null;
            pickRound: number | null;
            cashAmount: number | null;
        })[];
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
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        status: string;
        submittedDay: number;
        decisionDay: number;
        expiresDay: number | null;
        decisionReason: string | null;
        resolvedAt: Date | null;
        fromTeamId: number;
        toTeamId: number;
        cashOut: number;
        cashIn: number;
        aiScore: number | null;
        validation: import("@prisma/client/runtime/library").JsonValue | null;
        counterPayload: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    submitTradeProposal(dto: SubmitTradeProposalDto): Promise<{
        items: ({
            player: {
                id: number;
                name: string;
                position: string;
                salary: number | null;
                overallCurrent: number;
                potential: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            playerId: number | null;
            proposalId: number;
            itemType: string;
            direction: string;
            pickYear: number | null;
            pickRound: number | null;
            cashAmount: number | null;
        })[];
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
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        status: string;
        submittedDay: number;
        decisionDay: number;
        expiresDay: number | null;
        decisionReason: string | null;
        resolvedAt: Date | null;
        fromTeamId: number;
        toTeamId: number;
        cashOut: number;
        cashIn: number;
        aiScore: number | null;
        validation: import("@prisma/client/runtime/library").JsonValue | null;
        counterPayload: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    withdrawTradeProposal(saveId: number, proposalId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        status: string;
        submittedDay: number;
        decisionDay: number;
        expiresDay: number | null;
        decisionReason: string | null;
        resolvedAt: Date | null;
        fromTeamId: number;
        toTeamId: number;
        cashOut: number;
        cashIn: number;
        aiScore: number | null;
        validation: import("@prisma/client/runtime/library").JsonValue | null;
        counterPayload: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    listNegotiationEvents(saveId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        title: string;
        body: string | null;
        entityType: string;
        entityId: number;
        eventType: string;
        actor: string;
        day: number;
        payload: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    listTransactionHistory(saveId: number): Promise<{
        id: number;
        teamId: number | null;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        status: string;
        title: string;
        body: string | null;
        day: number;
        payload: import("@prisma/client/runtime/library").JsonValue | null;
        category: string;
        referenceType: string;
        referenceId: number;
    }[]>;
    snapshotTeamCapsForDay(saveId: number, day: number): Promise<void>;
    signFreeAgent(dto: SignFreeAgentDto): Promise<{
        team: {
            id: number;
            name: string;
            shortName: string;
            logoPath: string | null;
        };
    } & {
        number: number | null;
        id: number;
        name: string;
        externalRef: string | null;
        jerseyNumber: number | null;
        jerseyCode: string | null;
        position: string;
        salary: number | null;
        teamId: number;
        createdAt: Date;
        updatedAt: Date;
        firstName: string | null;
        birthDate: Date | null;
        age: number | null;
        debutYear: number | null;
        finalYear: number | null;
        school: string | null;
        hallOfFame: boolean | null;
        heightCm: number | null;
        weightKg: number | null;
        nationality: string | null;
        bioSource: string | null;
        gamesCareer: number | null;
        ptsCareer: number | null;
        trbCareer: number | null;
        astCareer: number | null;
        fgPct: number | null;
        fg3Pct: number | null;
        ftPct: number | null;
        efgPct: number | null;
        per: number | null;
        ws: number | null;
        active: boolean;
        offensiveRating: number;
        overallBase: number;
        overall: number;
        overallCurrent: number;
        defensiveRating: number;
        physicalRating: number;
        iqRating: number;
        form: number;
        morale: number;
        fatigue: number;
        formTrendDays: number;
        lastFormSnapshot: number;
        potential: number;
        handedness: string | null;
        primaryPosition: string;
        secondaryPosition: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        lastName: string | null;
        nbaPlayerId: number | null;
    }>;
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
            playerId: number;
            years: number;
            status: string;
            offerId: number;
            proposedSalary: number;
            role: string;
            responseDeadlineDay: number;
        })[];
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
            playerId: number;
            direction: string;
            offerId: number;
            side: string;
        })[];
        transactionLogs: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            saveId: number;
            status: string;
            eventType: string;
            day: number;
            payload: import("@prisma/client/runtime/library").JsonValue | null;
            fromTeamId: number;
            toTeamId: number;
            offerId: number;
            message: string | null;
        }[];
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        status: string;
        resolvedAt: Date | null;
        fromTeamId: number;
        toTeamId: number;
        cashOut: number;
        cashIn: number;
        sellOnPct: number | null;
        createdDay: number;
        resolveDay: number;
        aiReason: string | null;
    }[]>;
    createOffer(dto: CreateTransferOfferDto): Promise<{
        contractProposals: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            playerId: number;
            years: number;
            status: string;
            offerId: number;
            proposedSalary: number;
            role: string;
            responseDeadlineDay: number;
        }[];
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
        playerPieces: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            playerId: number;
            direction: string;
            offerId: number;
            side: string;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        status: string;
        resolvedAt: Date | null;
        fromTeamId: number;
        toTeamId: number;
        cashOut: number;
        cashIn: number;
        outgoingPlayerIds: number[];
        incomingPlayerIds: number[];
        sellOnPct: number | null;
        createdDay: number;
        resolveDay: number;
        aiReason: string | null;
    }>;
    sendOffer(saveId: number, offerId: number): Promise<{
        contractProposals: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            playerId: number;
            years: number;
            status: string;
            offerId: number;
            proposedSalary: number;
            role: string;
            responseDeadlineDay: number;
        }[];
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
        playerPieces: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            playerId: number;
            direction: string;
            offerId: number;
            side: string;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        saveId: number;
        status: string;
        resolvedAt: Date | null;
        fromTeamId: number;
        toTeamId: number;
        cashOut: number;
        cashIn: number;
        outgoingPlayerIds: number[];
        incomingPlayerIds: number[];
        sellOnPct: number | null;
        createdDay: number;
        resolveDay: number;
        aiReason: string | null;
    }>;
    resolvePendingOffersForDay(saveId: number, day: number, date: Date): Promise<number>;
    respondToPlayerProposal(dto: PlayerProposalResponseDto): Promise<{
        success: boolean;
    }>;
    resolvePendingPlayerProposalResponsesForDay(saveId: number, day: number, date: Date): Promise<number>;
    resolvePendingContractOffersForDay(saveId: number, day: number, date: Date): Promise<number>;
    resolvePendingTradeProposalsForDay(saveId: number, day: number, date: Date): Promise<number>;
    private executeAcceptedTradeProposal;
    private computeTradeFitBonus;
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
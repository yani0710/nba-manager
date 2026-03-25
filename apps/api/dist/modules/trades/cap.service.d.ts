export type CapConfig = {
    salaryCap: number;
    luxuryTaxThreshold: number;
    apron: number;
    hardCap: number;
    minRosterCharge: number;
    minRosterSize: number;
};
export declare const DEFAULT_CAP_CONFIG: CapConfig;
export type TeamCapSummary = {
    teamId: number;
    payroll: number;
    activeRosterCount: number;
    capHolds: number;
    deadSalary: number;
    minimumRosterCharges: number;
    salaryCap: number;
    luxuryTaxThreshold: number;
    apron: number;
    hardCap: number;
    capSpace: number;
    overCap: boolean;
    overTax: boolean;
    luxuryTaxOwed: number;
};
export declare class CapService {
    private config;
    constructor(config?: CapConfig);
    calculateTeamPayroll(teamId: number): Promise<{
        payroll: number;
        activeRosterCount: number;
        minimumRosterCharges: number;
        deadSalary: number;
        capHolds: number;
    }>;
    calculateLuxuryTax(teamId: number): Promise<number>;
    calculateCapSpace(teamId: number): Promise<number>;
    getTeamCapSummary(teamId: number): Promise<TeamCapSummary>;
    validateContractOffer(teamId: number, offer: {
        salaryPerYear: number;
        years: number;
    }): Promise<{
        legal: boolean;
        projectedPayroll: number;
        projectedCapSpace: number;
        legalByCapRoom: boolean;
        legalByException: boolean;
        warnings: string[];
        summary: TeamCapSummary;
    }>;
    validateTradeProposal(proposal: {
        fromTeamId: number;
        toTeamId: number;
        outgoingPlayerIds: number[];
        incomingPlayerIds: number[];
        cashOut?: number;
        cashIn?: number;
    }): Promise<{
        legal: boolean;
        outgoing: number;
        incoming: number;
        fromProjected: number;
        toProjected: number;
        reasons: string[];
        fromSummary: TeamCapSummary;
        toSummary: TeamCapSummary;
    }>;
}
//# sourceMappingURL=cap.service.d.ts.map
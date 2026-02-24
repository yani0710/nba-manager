type EnrichedRosterPlayer = {
    rosterSource: "nba_salaries_clean.csv";
    rosterName: string;
    rosterTeamCode: string;
    salary: number | null;
    contractEndYear: number | null;
    guaranteed: number | null;
    enrichmentMatched: boolean;
    enrichmentWarning?: string;
    id: number | null;
    name: string;
    teamId: number | null;
    team?: {
        id: number;
        name: string;
        shortName: string;
    } | null;
    position: string | null;
    number: number | null;
    jerseyNumber: number | null;
    overall: number | null;
    overallBase: number | null;
    overallCurrent: number | null;
    form: number | null;
    fatigue: number | null;
    morale: number | null;
    heightCm: number | null;
    weightKg: number | null;
    nationality: string | null;
    birthDate: Date | null;
    age: number | null;
    externalRef: string | null;
    attributes?: unknown;
};
export type SalariesRosterHealth = {
    sourceFile: string;
    totalPlayersFromSalaries: number;
    matchedInDb: number;
    missingInDb: number;
    missingSample: string[];
    ambiguousWarnings: string[];
};
export declare function enrichPlayersFromSalariesRoster(): Promise<{
    byTeam: Map<string, EnrichedRosterPlayer[]>;
    health: SalariesRosterHealth;
}>;
export {};
//# sourceMappingURL=enrichPlayers.d.ts.map
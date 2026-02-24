export type SalariesRosterRow = {
    rawName: string;
    normalizedName: string;
    teamCode: string;
    salary: number | null;
    contractEndYear: number | null;
    guaranteed: number | null;
    season?: string | null;
    sourceRow: Record<string, string>;
};
export type TeamRosterMap = Map<string, SalariesRosterRow[]>;
declare const PLAYER_ALIASES: Record<string, string>;
export declare function normalizePlayerName(input: string): string;
export declare function loadSalariesRosterRows(): {
    filePath: string;
    rows: SalariesRosterRow[];
};
export declare function buildTeamRoster(): {
    filePath: string;
    teamRoster: TeamRosterMap;
    players: SalariesRosterRow[];
};
export { PLAYER_ALIASES };
//# sourceMappingURL=loadSalariesRoster.d.ts.map
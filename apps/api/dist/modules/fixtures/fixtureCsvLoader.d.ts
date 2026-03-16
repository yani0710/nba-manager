type TeamLookup = {
    id: number;
    name: string;
    shortName: string;
};
export type FixtureSeedRecord = {
    homeTeamId: number;
    awayTeamId: number;
    gameDate: Date;
    status: "scheduled";
    homeScore: number;
    awayScore: number;
    source: {
        dateText: string;
        startEt: string;
        homeTeamName: string;
        awayTeamName: string;
        sourceHomeScore: number | null;
        sourceAwayScore: number | null;
        arena: string | null;
        notes: string | null;
    };
};
type LoadFixtureCsvResult = {
    fixtures: FixtureSeedRecord[];
    report: {
        rowsRead: number;
        rowsForSeason: number;
        skippedRows: number;
        duplicateRows: number;
        mappedTeams: number;
        unmappedTeams: string[];
        fields: string[];
    };
};
export declare function loadFixturesFromCsv(params: {
    season: string;
    teams: TeamLookup[];
    csvPath?: string;
}): LoadFixtureCsvResult;
export {};
//# sourceMappingURL=fixtureCsvLoader.d.ts.map
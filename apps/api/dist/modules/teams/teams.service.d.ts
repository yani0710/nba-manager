export declare class TeamsService {
    getAllTeams(saveId?: number): Promise<{
        players: any[];
        rosterMissingEnrichmentCount: number;
        awayGames: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            saveId: number | null;
            status: string;
            homeTeamId: number;
            awayTeamId: number;
            homeScore: number;
            awayScore: number;
            gameDate: Date;
        }[];
        homeGames: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            saveId: number | null;
            status: string;
            homeTeamId: number;
            awayTeamId: number;
            homeScore: number;
            awayScore: number;
            gameDate: Date;
        }[];
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        form: number;
        morale: number;
        shortName: string;
        nbaTeamId: number | null;
        city: string;
        conference: string | null;
        division: string | null;
        primaryColor: string | null;
        secondaryColor: string | null;
        logoKey: string | null;
        logoPath: string | null;
    }[]>;
    getTeamById(id: number, saveId?: number): Promise<{
        players: any[];
        rosterMissingEnrichmentCount: number;
        awayGames: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            saveId: number | null;
            status: string;
            homeTeamId: number;
            awayTeamId: number;
            homeScore: number;
            awayScore: number;
            gameDate: Date;
        }[];
        homeGames: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            saveId: number | null;
            status: string;
            homeTeamId: number;
            awayTeamId: number;
            homeScore: number;
            awayScore: number;
            gameDate: Date;
        }[];
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        form: number;
        morale: number;
        shortName: string;
        nbaTeamId: number | null;
        city: string;
        conference: string | null;
        division: string | null;
        primaryColor: string | null;
        secondaryColor: string | null;
        logoKey: string | null;
        logoPath: string | null;
    } | null>;
    getTeamByName(name: string, saveId?: number): Promise<{
        players: any[];
        rosterMissingEnrichmentCount: number;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        form: number;
        morale: number;
        shortName: string;
        nbaTeamId: number | null;
        city: string;
        conference: string | null;
        division: string | null;
        primaryColor: string | null;
        secondaryColor: string | null;
        logoKey: string | null;
        logoPath: string | null;
    } | null>;
    getRosterByTeamId(id: number, saveId?: number): Promise<{
        id: number;
        name: string;
        shortName: string;
        city: string;
        conference: string | null;
        division: string | null;
        logoPath: string | null;
        roster: any[];
        rosterSource: string;
        rosterEnrichment: {
            total: number;
            missing: number;
        };
        teamState: {
            form: number;
            last5: string;
            streak: number;
            offenseRating: number;
            defenseRating: number;
        };
    } | null>;
    private resolveSalary;
    private buildRosterByTeamId;
    private attachTeamState;
    private readSingleTeamState;
}
//# sourceMappingURL=teams.service.d.ts.map
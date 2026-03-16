type TeamLike = {
    id: number;
    name: string;
    shortName: string;
    city?: string | null;
    logoPath?: string | null;
};
type GameLike = {
    id: number;
    saveId?: number | null;
    homeTeamId: number;
    awayTeamId: number;
    homeScore: number;
    awayScore: number;
    gameDate: Date;
    status: string;
    homeTeam: TeamLike;
    awayTeam: TeamLike;
};
export type FixtureModel = {
    id: number;
    saveId: number | null;
    homeTeamId: number;
    awayTeamId: number;
    homeScore: number;
    awayScore: number;
    gameDate: Date;
    status: string;
    homeTeam: TeamLike;
    awayTeam: TeamLike;
};
export declare function toFixtureModel(game: GameLike): FixtureModel;
export {};
//# sourceMappingURL=fixtureModel.d.ts.map
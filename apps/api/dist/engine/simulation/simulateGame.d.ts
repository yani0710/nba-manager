/**
 * Pure simulation logic - no DB access, no HTTP
 * Used by services to compute game outcomes
 */
export interface SimPlayerInput {
    playerId: number;
    position: string;
    matchOverall: number;
    form: number;
}
interface PlayerPerformance {
    playerId: number;
    minutes: number;
    points: number;
    twoPtMade: number;
    twoPtAtt: number;
    threePtMade: number;
    threePtAtt: number;
    ftMade: number;
    ftAtt: number;
    dunks: number;
    oreb: number;
    dreb: number;
    rebounds: number;
    assists: number;
    turnovers: number;
    stl: number;
    blk: number;
    fouls: number;
    plusMinus: number;
    performanceRating: number;
    fgm: number;
    fga: number;
}
type TeamTactics = {
    pace?: "slow" | "balanced" | "fast";
    threePtFocus?: number;
    defenseScheme?: "drop" | "switch" | "press";
};
type SimOptions = {
    homeTactics?: TeamTactics;
    awayTactics?: TeamTactics;
    homeTeamForm?: number;
    awayTeamForm?: number;
    homeTrainingRating?: number;
    awayTrainingRating?: number;
};
export declare function simulateGame(homePlayers: SimPlayerInput[], awayPlayers: SimPlayerInput[], homeTeamRating: number, awayTeamRating: number, options?: SimOptions): {
    homeScore: number;
    awayScore: number;
    homeStats: PlayerPerformance[];
    awayStats: PlayerPerformance[];
};
export declare function getTeamRating(players: SimPlayerInput[], teamForm?: number): number;
export {};
//# sourceMappingURL=simulateGame.d.ts.map
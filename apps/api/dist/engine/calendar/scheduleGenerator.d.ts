export type ScheduledGame = {
    homeTeamId: number;
    awayTeamId: number;
    gameDate: Date;
    status: "scheduled" | "final";
    homeScore: number;
    awayScore: number;
};
export declare function generateSeasonSchedule(teamIds: number[], seasonStartDate: Date): ScheduledGame[];
//# sourceMappingURL=scheduleGenerator.d.ts.map
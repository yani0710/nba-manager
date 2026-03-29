export declare class PlayersService {
    getPlayersByTeamId(teamId: number, includeInactive?: boolean, saveId?: number): Promise<any[]>;
    getPlayerById(id: number, saveId?: number): Promise<any>;
    getAllPlayers(take?: number, includeInactive?: boolean, saveId?: number): Promise<any[]>;
    private applySalaryFallbackFromRoster;
    private applyDetailedPositionFallback;
    getPlayerStats(playerId: number, saveId?: number): Promise<{
        gamesPlayed: number;
        totals: {
            minutes: number;
            points: number;
            rebounds: number;
            assists: number;
            fgMade: number;
            fgAtt: number;
            fgPct: number;
        };
        averages: {
            minutes: number;
            points: number;
            rebounds: number;
            assists: number;
            fgPct: number;
        };
        lastFive: {
            gameId: number;
            date: Date;
            minutes: number;
            points: number;
            rebounds: number;
            assists: number;
            fgMade: number;
            fgAtt: number;
        }[];
    }>;
    private attachSaveState;
    private attachSaveStateToRoster;
    private buildStrengthsWeaknesses;
    private attachTransferOverridesToPlayers;
    private buildRosterOverridesByTeam;
}
//# sourceMappingURL=players.service.d.ts.map
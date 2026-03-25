export declare class PlayersService {
    getPlayersByTeamId(teamId: number, includeInactive?: boolean, saveId?: number): Promise<any[]>;
    getPlayerById(id: number, saveId?: number): Promise<any>;
    getAllPlayers(take?: number, includeInactive?: boolean, saveId?: number): Promise<any[]>;
    private applySalaryFallbackFromRoster;
    private applyDetailedPositionFallback;
    getPlayerStats(playerId: number, saveId?: number): Promise<{
        gamesPlayed: number;
        totals: {
            points: number;
            rebounds: number;
            assists: number;
        };
        averages: {
            points: number;
            rebounds: number;
            assists: number;
        };
        lastFive: {
            gameId: number;
            date: Date;
            points: number;
            rebounds: number;
            assists: number;
        }[];
    }>;
    private attachSaveState;
    private attachSaveStateToRoster;
    private buildStrengthsWeaknesses;
    private attachTransferOverridesToPlayers;
    private buildRosterOverridesByTeam;
}
//# sourceMappingURL=players.service.d.ts.map
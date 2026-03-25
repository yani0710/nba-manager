type PositionIndex = {
    byNameTeam: Map<string, string>;
    byName: Map<string, string>;
};
export declare function mapTeamCodeForPositions(input: string): string;
export declare function normalizeDetailedPos(raw: string): string | null;
export declare function getDetailedPositionIndex(): PositionIndex;
export declare function resolveDetailedPosition(playerName: string, teamCode: string | null | undefined, currentPosition: string | null | undefined): string | null;
export {};
//# sourceMappingURL=loadDetailedPositions.d.ts.map
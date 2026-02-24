type PositionGroup = "PG" | "SG" | "SF" | "PF" | "C";
export type ImpactRatingInput = {
    playerId: number;
    position: string;
    heightCm: number | null;
    weightKg: number | null;
    mpg: number;
    minTotal: number;
    onBallPct: number;
    dpm: number;
    odpm: number;
    ddpm: number;
    pts: number;
    ptsCreated: number;
    ast: number;
    rimAst: number;
    reb: number;
    ts: number;
    rts: number;
    tov: number;
    ctovPct: number;
    twoPpct: number;
    threePpct: number;
    threePA: number;
    ftPct: number;
    fta: number;
    oreb: number;
    dreb: number;
    stl: number;
    blk: number;
};
export type ImpactRatingOutput = {
    playerId: number;
    positionGroup: PositionGroup;
    att: number;
    play: number;
    def: number;
    phy: number;
    iq: number;
    overall: number;
    attributes: Record<string, unknown>;
};
export declare function computeImpactRatings(inputs: ImpactRatingInput[]): ImpactRatingOutput[];
export declare function computeTeamForm(players: Array<{
    overall: number;
    dpm: number;
}>): number;
export {};
//# sourceMappingURL=impactRatings.d.ts.map
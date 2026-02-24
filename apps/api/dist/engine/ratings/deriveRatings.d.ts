export type AdvancedVector = {
    pos: string;
    per: number | null;
    tsPercent: number | null;
    x3pAr: number | null;
    orbPercent: number | null;
    drbPercent: number | null;
    trbPercent: number | null;
    astPercent: number | null;
    stlPercent: number | null;
    blkPercent: number | null;
    tovPercent: number | null;
    usgPercent: number | null;
    ws48: number | null;
    obpm: number | null;
    dbpm: number | null;
    bpm: number | null;
    vorp: number | null;
};
export type RatingAttributes = {
    shooting3: number;
    shootingMid: number;
    finishing: number;
    playmaking: number;
    rebounding: number;
    defense: number;
    athleticism: number;
    iq: number;
};
export type RatingOutcome = {
    attributes: RatingAttributes;
    overall: number;
    potential: number;
};
type SkillRaw = RatingAttributes;
export declare function deriveRawSkills(v: AdvancedVector): SkillRaw;
export declare function deriveRatingsForLeague(players: Array<{
    id: number;
    externalRef: string | null;
    age: number;
    advanced: AdvancedVector;
}>): Map<number, RatingOutcome>;
export declare function derivePlayerFormFromGameScores(gameScores: number[]): number;
export declare function deriveFallbackForm(bpm: number | null, ws48: number | null): number;
export declare function deriveTeamForm(lastFiveResults: Array<"W" | "L">): number;
export {};
//# sourceMappingURL=deriveRatings.d.ts.map
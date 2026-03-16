export declare const FIXTURE_STATUSES: readonly ["scheduled", "live", "simulated", "completed", "postponed", "final"];
export type FixtureStatus = (typeof FIXTURE_STATUSES)[number];
export declare const SIMULATABLE_GAME_STATUSES: FixtureStatus[];
export declare const UPCOMING_GAME_STATUSES: FixtureStatus[];
export declare const COMPLETED_GAME_STATUSES: FixtureStatus[];
export declare function normalizeFixtureStatus(value: string | null | undefined): FixtureStatus;
export declare function isCompletedFixtureStatus(value: string | null | undefined): boolean;
//# sourceMappingURL=fixtureStatus.d.ts.map
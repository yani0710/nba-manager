type ProbeResult = {
    ok: boolean;
    status: number;
    bodyPreview?: string;
    data?: unknown;
};
type AuthMode = "apisports" | "rapidapi" | "missing";
export declare function resolveAuthMode(): AuthMode;
export declare function checkApiSportsConnectivity(): Promise<{
    baseUrl: string;
    authMode: AuthMode;
    status: ProbeResult;
    seasons: ProbeResult;
    availableSeasons: number[];
    selectedSeason: number;
    selectedLeague: string;
    friendlyError: string | null;
}>;
export {};
//# sourceMappingURL=apisportsCheck.d.ts.map
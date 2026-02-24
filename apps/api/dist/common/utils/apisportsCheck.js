"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAuthMode = resolveAuthMode;
exports.checkApiSportsConnectivity = checkApiSportsConnectivity;
function getBaseUrl() {
    return process.env.APISPORTS_NBA_BASE_URL ?? "https://v2.nba.api-sports.io";
}
function getHostFromBaseUrl(baseUrl) {
    try {
        return new URL(baseUrl).host;
    }
    catch {
        return "v2.nba.api-sports.io";
    }
}
function resolveAuthMode() {
    if (process.env.APISPORTS_RAPIDAPI_KEY)
        return "rapidapi";
    if (process.env.APISPORTS_API_KEY)
        return "apisports";
    return "missing";
}
function buildHeaders(baseUrl) {
    const mode = resolveAuthMode();
    if (mode === "rapidapi") {
        return {
            "X-RapidAPI-Key": process.env.APISPORTS_RAPIDAPI_KEY,
            "X-RapidAPI-Host": getHostFromBaseUrl(baseUrl),
        };
    }
    if (mode === "apisports") {
        return {
            "x-apisports-key": process.env.APISPORTS_API_KEY,
        };
    }
    return {};
}
async function probeEndpoint(baseUrl, endpoint) {
    const headers = buildHeaders(baseUrl);
    const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        headers,
    });
    const raw = await response.text();
    let json = null;
    try {
        json = JSON.parse(raw);
    }
    catch {
        json = null;
    }
    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            bodyPreview: raw.slice(0, 200),
        };
    }
    return {
        ok: true,
        status: response.status,
        data: json ?? raw,
    };
}
function extractSeasons(payload) {
    if (!payload || typeof payload !== "object")
        return [];
    const response = payload.response;
    if (!Array.isArray(response))
        return [];
    return response
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
}
async function checkApiSportsConnectivity() {
    const baseUrl = getBaseUrl();
    const mode = resolveAuthMode();
    const statusResult = await probeEndpoint(baseUrl, "/status");
    const seasonsResult = await probeEndpoint(baseUrl, "/seasons");
    const seasons = seasonsResult.ok ? extractSeasons(seasonsResult.data) : [];
    const friendlyError = !statusResult.ok && statusResult.status === 403
        ? "API key not valid for v2.nba.api-sports.io (wrong platform key or NBA not enabled)."
        : null;
    return {
        baseUrl,
        authMode: mode,
        status: statusResult,
        seasons: seasonsResult,
        availableSeasons: seasons,
        selectedSeason: Number(process.env.APISPORTS_NBA_SEASON ?? process.env.NBA_SEASON ?? "2025"),
        selectedLeague: process.env.APISPORTS_NBA_LEAGUE ?? "standard",
        friendlyError,
    };
}
//# sourceMappingURL=apisportsCheck.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPLETED_GAME_STATUSES = exports.UPCOMING_GAME_STATUSES = exports.SIMULATABLE_GAME_STATUSES = exports.FIXTURE_STATUSES = void 0;
exports.normalizeFixtureStatus = normalizeFixtureStatus;
exports.isCompletedFixtureStatus = isCompletedFixtureStatus;
exports.FIXTURE_STATUSES = [
    "scheduled",
    "live",
    "simulated",
    "completed",
    "postponed",
    // Legacy status still present in existing saves.
    "final",
];
exports.SIMULATABLE_GAME_STATUSES = ["scheduled"];
exports.UPCOMING_GAME_STATUSES = ["scheduled", "live", "postponed"];
exports.COMPLETED_GAME_STATUSES = ["simulated", "completed", "final"];
function normalizeFixtureStatus(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "final")
        return "completed";
    if (exports.FIXTURE_STATUSES.includes(normalized)) {
        return normalized;
    }
    return "scheduled";
}
function isCompletedFixtureStatus(value) {
    return exports.COMPLETED_GAME_STATUSES.includes(String(value ?? "").trim().toLowerCase());
}
//# sourceMappingURL=fixtureStatus.js.map
"use strict";
// Ratings - Player/team rating system (to be implemented)
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePlayerRating = calculatePlayerRating;
exports.calculateTeamRating = calculateTeamRating;
function calculatePlayerRating(player) {
    // Based on salary, position, performance
    return Math.min(99, Math.max(1, Math.floor(player.salary / 1500000)));
}
function calculateTeamRating(players) {
    if (players.length === 0)
        return 50;
    const avgRating = players.reduce((sum, p) => sum + calculatePlayerRating(p), 0) / players.length;
    return Math.round(avgRating);
}
//# sourceMappingURL=ratings.js.map
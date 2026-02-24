"use strict";
/**
 * Salary Cap - Team payroll and cap management
 * NBA hard cap, luxury tax, minimum payroll
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamPayroll = getTeamPayroll;
exports.getCapSpace = getCapSpace;
exports.isOverCapThreshold = isOverCapThreshold;
exports.isInLuxuryTax = isInLuxuryTax;
exports.calculateLuxuryTax = calculateLuxuryTax;
const NBA_CAP_2024 = 136000000; // ~$136M
const LUXURY_TAX_THRESHOLD = 165000000;
const MINIMUM_PAYROLL = 99000000;
function getTeamPayroll(players) {
    return players.reduce((sum, p) => sum + (p.salary || 0), 0);
}
function getCapSpace(teamPayroll) {
    return Math.max(0, NBA_CAP_2024 - teamPayroll);
}
function isOverCapThreshold(teamPayroll) {
    return teamPayroll > NBA_CAP_2024;
}
function isInLuxuryTax(teamPayroll) {
    return teamPayroll > LUXURY_TAX_THRESHOLD;
}
function calculateLuxuryTax(teamPayroll) {
    if (teamPayroll <= LUXURY_TAX_THRESHOLD)
        return 0;
    const overage = teamPayroll - LUXURY_TAX_THRESHOLD;
    // Simplified tax structure
    return Math.floor(overage * 1.5);
}
//# sourceMappingURL=salaryCap.js.map
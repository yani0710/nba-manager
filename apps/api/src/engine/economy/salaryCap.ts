/**
 * Salary Cap - Team payroll and cap management
 * NBA hard cap, luxury tax, minimum payroll
 */

const NBA_CAP_2024 = 136000000; // ~$136M
const LUXURY_TAX_THRESHOLD = 165000000;
const MINIMUM_PAYROLL = 99000000;

export function getTeamPayroll(players: any[]) {
  return players.reduce((sum, p) => sum + (p.salary || 0), 0);
}

export function getCapSpace(teamPayroll: number) {
  return Math.max(0, NBA_CAP_2024 - teamPayroll);
}

export function isOverCapThreshold(teamPayroll: number) {
  return teamPayroll > NBA_CAP_2024;
}

export function isInLuxuryTax(teamPayroll: number) {
  return teamPayroll > LUXURY_TAX_THRESHOLD;
}

export function calculateLuxuryTax(teamPayroll: number) {
  if (teamPayroll <= LUXURY_TAX_THRESHOLD) return 0;

  const overage = teamPayroll - LUXURY_TAX_THRESHOLD;
  // Simplified tax structure
  return Math.floor(overage * 1.5);
}

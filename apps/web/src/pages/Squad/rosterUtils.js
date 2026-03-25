export const ROSTER_CATEGORIES = [
  { key: 'guaranteed', label: 'Guaranteed Contracts' },
  { key: 'bench', label: 'Bench Unit' },
  { key: 'starters', label: 'Starters' },
  { key: 'twoWay', label: 'Two-Way Contracts' },
  { key: 'freeAgents', label: 'Free Agents' },
  { key: 'tradeBlock', label: 'Trade Block' },
  { key: 'development', label: 'G League / Development League' },
  { key: 'injured', label: 'Injured List' },
  { key: 'expiring', label: 'Expiring Contracts' },
];

export const ROLE_OPTIONS = ['star', 'starter', 'sixth', 'rotation', 'bench', 'prospect'];

export const MIN_SALARY = 1_200_000;
export const DEFAULT_SALARY_CAP = 145_000_000;
export const FREE_AGENT_TEAM_CODE = 'FA';

export function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function toMoneyMillions(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '$0.0M';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
}

export function getPosTokens(position) {
  return String(position || '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
}

export function getPlayerSalary(player) {
  const direct = Number(player?.salary);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const contract = player?.contracts;
  const currentYear = Number(contract?.currentYearSalary);
  if (Number.isFinite(currentYear) && currentYear > 0) return currentYear;

  const base = Number(contract?.salary);
  if (Number.isFinite(base) && base > 0) return base;

  const aav = Number(contract?.averageAnnualValue);
  if (Number.isFinite(aav) && aav > 0) return aav;

  const contractYears = Array.isArray(contract?.contractYears) ? contract.contractYears : [];
  const yearSalary = contractYears
    .map((row) => Number(row?.salary))
    .find((n) => Number.isFinite(n) && n > 0);
  if (Number.isFinite(yearSalary) && yearSalary > 0) return yearSalary;

  return 0;
}

export function parseAge(player) {
  const n = Number(player?.age);
  return Number.isFinite(n) ? n : null;
}

export function parseOverall(player) {
  return Number(player?.overallCurrent ?? player?.overall ?? 60);
}

export function parsePotential(player) {
  return Number(player?.potential ?? parseOverall(player));
}

export function parseStat(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getContractMeta(player, seasonLabel) {
  const contract = player?.contracts ?? null;
  const endYear = Number(contract?.endYear);
  const startYear = Number(contract?.startYear);
  const seasonStartYear = Number(String(seasonLabel ?? '').slice(0, 4)) || new Date().getUTCFullYear();
  const seasonEndYear = seasonStartYear + 1;
  let yearsRemaining = 0;
  if (Number.isFinite(endYear) && endYear > 0) {
    yearsRemaining = Math.max(0, endYear - seasonStartYear + 1);
  } else if (Array.isArray(contract?.contractYears) && contract.contractYears.length > 0) {
    yearsRemaining = contract.contractYears.length;
  } else if (Number.isFinite(startYear) && startYear > 0 && Number.isFinite(endYear) && endYear >= startYear) {
    yearsRemaining = endYear - startYear + 1;
  }
  const isTwoWay = Boolean(contract?.isTwoWay);
  const isExpiring = Number.isFinite(endYear) ? endYear <= seasonEndYear : yearsRemaining <= 1;
  const hasActiveContract = Boolean(contract) && yearsRemaining > 0;
  return { yearsRemaining, isTwoWay, isExpiring, hasActiveContract, endYear: Number.isFinite(endYear) ? endYear : null };
}

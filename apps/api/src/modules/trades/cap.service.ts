import prisma from "../../config/prisma";

export type CapConfig = {
  salaryCap: number;
  luxuryTaxThreshold: number;
  apron: number;
  hardCap: number;
  minRosterCharge: number;
  minRosterSize: number;
};

export const DEFAULT_CAP_CONFIG: CapConfig = {
  salaryCap: Number(process.env.NBA_CAP_SALARY ?? 145_000_000),
  luxuryTaxThreshold: Number(process.env.NBA_CAP_TAX ?? 172_000_000),
  apron: Number(process.env.NBA_CAP_APRON ?? 179_000_000),
  hardCap: Number(process.env.NBA_CAP_HARD ?? 179_000_000),
  minRosterCharge: Number(process.env.NBA_MIN_ROSTER_CHARGE ?? 1_200_000),
  minRosterSize: Number(process.env.NBA_MIN_ROSTER_SIZE ?? 14),
};

export type TeamCapSummary = {
  teamId: number;
  payroll: number;
  activeRosterCount: number;
  capHolds: number;
  deadSalary: number;
  minimumRosterCharges: number;
  salaryCap: number;
  luxuryTaxThreshold: number;
  apron: number;
  hardCap: number;
  capSpace: number;
  overCap: boolean;
  overTax: boolean;
  luxuryTaxOwed: number;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export class CapService {
  private config: CapConfig;

  constructor(config: CapConfig = DEFAULT_CAP_CONFIG) {
    this.config = config;
  }

  async calculateTeamPayroll(teamId: number) {
    const players = await prisma.player.findMany({
      where: { active: true, teamId },
      include: {
        contracts: {
          select: {
            currentYearSalary: true,
            salary: true,
            averageAnnualValue: true,
            contractYears: true,
          },
        },
      },
    });
    const activeRosterCount = players.length;
    const payrollPlayers = players.reduce((sum, p) => {
      const direct = toNum(p.salary);
      if (direct > 0) return sum + direct;
      const current = toNum(p.contracts?.currentYearSalary);
      if (current > 0) return sum + current;
      const base = toNum(p.contracts?.salary);
      if (base > 0) return sum + base;
      const aav = toNum(p.contracts?.averageAnnualValue);
      if (aav > 0) return sum + aav;
      const fromYears = Array.isArray(p.contracts?.contractYears)
        ? p.contracts!.contractYears.map((y) => toNum(y.salary)).find((x) => x > 0) ?? 0
        : 0;
      if (fromYears > 0) return sum + fromYears;
      return sum;
    }, 0);

    const minimumRosterCharges = Math.max(0, this.config.minRosterSize - activeRosterCount) * this.config.minRosterCharge;
    const deadSalary = 0;
    const capHolds = 0;
    return {
      payroll: payrollPlayers + minimumRosterCharges + deadSalary + capHolds,
      activeRosterCount,
      minimumRosterCharges,
      deadSalary,
      capHolds,
    };
  }

  async calculateLuxuryTax(teamId: number) {
    const payrollData = await this.calculateTeamPayroll(teamId);
    const excess = Math.max(0, payrollData.payroll - this.config.luxuryTaxThreshold);
    return Math.round(excess * 1.25);
  }

  async calculateCapSpace(teamId: number) {
    const payrollData = await this.calculateTeamPayroll(teamId);
    return Math.round(this.config.salaryCap - payrollData.payroll);
  }

  async getTeamCapSummary(teamId: number): Promise<TeamCapSummary> {
    const payrollData = await this.calculateTeamPayroll(teamId);
    const capSpace = Math.round(this.config.salaryCap - payrollData.payroll);
    const luxuryTax = await this.calculateLuxuryTax(teamId);
    return {
      teamId,
      payroll: payrollData.payroll,
      activeRosterCount: payrollData.activeRosterCount,
      capHolds: payrollData.capHolds,
      deadSalary: payrollData.deadSalary,
      minimumRosterCharges: payrollData.minimumRosterCharges,
      salaryCap: this.config.salaryCap,
      luxuryTaxThreshold: this.config.luxuryTaxThreshold,
      apron: this.config.apron,
      hardCap: this.config.hardCap,
      capSpace,
      overCap: payrollData.payroll > this.config.salaryCap,
      overTax: payrollData.payroll > this.config.luxuryTaxThreshold,
      luxuryTaxOwed: luxuryTax,
    };
  }

  async validateContractOffer(
    teamId: number,
    offer: { salaryPerYear: number; years: number },
  ) {
    const summary = await this.getTeamCapSummary(teamId);
    const offerSalary = Math.max(0, Math.round(toNum(offer.salaryPerYear)));
    const projectedPayroll = summary.payroll + offerSalary;
    const legalByCapRoom = summary.capSpace >= offerSalary;
    const legalByException = offerSalary <= 8_000_000; // simple MLE-style fallback
    const legal = legalByCapRoom || legalByException;
    const warnings: string[] = [];
    if (!legalByCapRoom && legalByException) warnings.push("Using exception cap pathway.");
    if (!legal) warnings.push("Insufficient cap room and no valid exception.");
    if (projectedPayroll > this.config.hardCap) warnings.push("This move would hard-cap the team.");
    return {
      legal,
      projectedPayroll,
      projectedCapSpace: this.config.salaryCap - projectedPayroll,
      legalByCapRoom,
      legalByException,
      warnings,
      summary,
    };
  }

  async validateTradeProposal(
    proposal: {
      fromTeamId: number;
      toTeamId: number;
      outgoingPlayerIds: number[];
      incomingPlayerIds: number[];
      cashOut?: number;
      cashIn?: number;
    },
  ) {
    const [fromSummary, toSummary, players] = await Promise.all([
      this.getTeamCapSummary(proposal.fromTeamId),
      this.getTeamCapSummary(proposal.toTeamId),
      prisma.player.findMany({
        where: { id: { in: [...proposal.outgoingPlayerIds, ...proposal.incomingPlayerIds] } },
        select: { id: true, salary: true, contracts: { select: { currentYearSalary: true, salary: true, averageAnnualValue: true } } },
      }),
    ]);
    const byId = new Map(players.map((p) => [p.id, p]));
    const salaryOf = (id: number) => {
      const p = byId.get(id);
      if (!p) return 0;
      return toNum(p.salary) || toNum(p.contracts?.currentYearSalary) || toNum(p.contracts?.salary) || toNum(p.contracts?.averageAnnualValue) || 0;
    };

    const outgoing = proposal.outgoingPlayerIds.reduce((s, id) => s + salaryOf(id), 0) + toNum(proposal.cashOut);
    const incoming = proposal.incomingPlayerIds.reduce((s, id) => s + salaryOf(id), 0) + toNum(proposal.cashIn);
    const fromProjected = fromSummary.payroll - outgoing + incoming;
    const toProjected = toSummary.payroll - incoming + outgoing;

    const overCapFrom = fromSummary.overCap;
    const overCapTo = toSummary.overCap;
    const matchRuleFrom = !overCapFrom || incoming <= outgoing * 1.25 + 250_000;
    const matchRuleTo = !overCapTo || outgoing <= incoming * 1.25 + 250_000;
    const legal = matchRuleFrom && matchRuleTo && fromProjected <= this.config.hardCap && toProjected <= this.config.hardCap;

    const reasons: string[] = [];
    if (!matchRuleFrom) reasons.push("From-team salary matching failed.");
    if (!matchRuleTo) reasons.push("To-team salary matching failed.");
    if (fromProjected > this.config.hardCap) reasons.push("From-team would exceed hard cap.");
    if (toProjected > this.config.hardCap) reasons.push("To-team would exceed hard cap.");

    return {
      legal,
      outgoing,
      incoming,
      fromProjected,
      toProjected,
      reasons,
      fromSummary,
      toSummary,
    };
  }
}


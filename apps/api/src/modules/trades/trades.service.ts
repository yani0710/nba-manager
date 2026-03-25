import prisma from "../../config/prisma";
import { BadRequestError, NotFoundError } from "../../common/errors/AppError";
import { CapService } from "./cap.service";
import { resolveDetailedPosition } from "../../data/loadDetailedPositions";

type CreateTransferOfferDto = {
  saveId: number;
  fromTeamId: number;
  toTeamId: number;
  outgoingPlayerIds: number[];
  incomingPlayerIds: number[];
  cashOut?: number;
  cashIn?: number;
  sellOnPct?: number | null;
  sendNow?: boolean;
};

type PlayerProposalResponseDto = {
  saveId: number;
  proposalId: number;
  action: "ACCEPT" | "NEGOTIATE" | "DECLINE";
  proposedSalary?: number;
  years?: number;
  role?: string;
};

type SignFreeAgentDto = {
  saveId: number;
  toTeamId: number;
  playerId: number;
  salary?: number;
  years?: number;
};

type SubmitContractOfferDto = {
  saveId: number;
  teamId: number;
  playerId: number;
  salaryPerYear: number;
  years: number;
  rolePromise: string;
  optionType?: string | null;
  decisionDays?: number;
};

type SubmitTradeProposalDto = {
  saveId: number;
  fromTeamId: number;
  toTeamId: number;
  outgoingPlayerIds: number[];
  incomingPlayerIds: number[];
  cashOut?: number;
  cashIn?: number;
  responseDays?: number;
};

const FREE_AGENT_TEAM_SHORT = "FA";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const __transferTestUtils = {
  hashString,
  mulberry32,
};

function parsePosBucket(pos: string | null | undefined): "G" | "W" | "B" {
  const p = String(pos ?? "").toUpperCase();
  if (p.includes("C")) return "B";
  if (p.includes("PF") || p.includes("SF")) return "W";
  return "G";
}

function seasonDayFromSave(save: { season: string; currentDate: Date; data: unknown }) {
  const payload = (save.data ?? {}) as { currentDate?: string };
  const saveDate = save.currentDate instanceof Date
    ? save.currentDate
    : new Date(`${String(payload.currentDate ?? "1970-01-01")}T00:00:00.000Z`);
  const current = new Date(`${saveDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const startYear = Number(String(save.season ?? "2025-26").slice(0, 4)) || current.getUTCFullYear();
  const seasonStart = new Date(Date.UTC(startYear, 9, 1)); // Oct 1
  return Math.max(0, Math.floor((current.getTime() - seasonStart.getTime()) / 86400000));
}

export class TradesService {
  private capService = new CapService();

  async listFreeAgents(saveId: number) {
    await this.ensureSave(saveId);
    const freeAgentTeam = await prisma.team.findUnique({
      where: { shortName: FREE_AGENT_TEAM_SHORT },
      select: { id: true },
    });
    if (!freeAgentTeam) return [];

    const players = await prisma.player.findMany({
      where: {
        active: true,
        teamId: freeAgentTeam.id,
      },
      include: {
        team: { select: { id: true, name: true, shortName: true, logoPath: true } },
      },
      orderBy: [{ overallCurrent: "desc" }, { overallBase: "desc" }, { name: "asc" }],
    });
    return players.map((player) => ({
      ...player,
      position: resolveDetailedPosition(player.name, player.team?.shortName ?? "FA", player.position) ?? player.position,
      primaryPosition: resolveDetailedPosition(player.name, player.team?.shortName ?? "FA", (player as any).primaryPosition ?? player.position) ?? (player as any).primaryPosition ?? player.position,
    }));
  }

  async getCapSummary(saveId: number, teamId: number) {
    await this.ensureSave(saveId);
    return this.capService.getTeamCapSummary(teamId);
  }

  async listContractOffers(saveId: number, teamId?: number) {
    await this.ensureSave(saveId);
    const offers = await prisma.contractOffer.findMany({
      where: {
        saveId,
        ...(teamId ? { teamId } : {}),
      },
      include: {
        player: { select: { id: true, name: true, position: true, overallCurrent: true, potential: true, team: { select: { id: true, name: true, shortName: true } } } },
        team: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return offers.map((offer) => ({
      ...offer,
      player: offer.player ? {
        ...offer.player,
        position: resolveDetailedPosition(offer.player.name, offer.player.team?.shortName ?? "", offer.player.position) ?? offer.player.position,
      } : offer.player,
    }));
  }

  async submitContractOffer(dto: SubmitContractOfferDto) {
    const save = await this.ensureSave(dto.saveId);
    const player = await prisma.player.findUnique({
      where: { id: dto.playerId },
      select: { id: true, name: true, teamId: true, overallCurrent: true, potential: true, salary: true },
    });
    if (!player) throw new NotFoundError("Player");

    const freeAgentTeam = await prisma.team.findUnique({ where: { shortName: FREE_AGENT_TEAM_SHORT }, select: { id: true } });
    if (!freeAgentTeam || player.teamId !== freeAgentTeam.id) throw new BadRequestError("Player is not in free agency");

    const validation = await this.capService.validateContractOffer(dto.teamId, {
      salaryPerYear: dto.salaryPerYear,
      years: dto.years,
    });
    if (!validation.legal) {
      throw new BadRequestError(`Cap violation: ${validation.warnings.join(" ") || "Offer is not legal under cap rules."}`);
    }

    const day = seasonDayFromSave(save);
    const decisionDays = clamp(Number(dto.decisionDays ?? 2), 1, 7);
    const expectedSalary = Math.round((player.salary ?? 1_500_000) * (1 + ((player.overallCurrent ?? 70) - 70) * 0.01));

    const offer = await prisma.contractOffer.create({
      data: {
        saveId: dto.saveId,
        teamId: dto.teamId,
        playerId: dto.playerId,
        salaryPerYear: Math.max(500_000, Math.round(dto.salaryPerYear)),
        years: clamp(Math.round(dto.years), 1, 5),
        rolePromise: dto.rolePromise || "rotation",
        optionType: dto.optionType ?? null,
        status: "PENDING",
        submittedDay: day,
        decisionDay: day + decisionDays,
        expiresDay: day + Math.max(decisionDays + 3, 7),
        expectedSalary,
        capSummary: validation as any,
      },
      include: {
        player: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, shortName: true } },
      },
    });

    await this.createInboxMessage({
      saveId: dto.saveId,
      date: save.currentDate,
      type: "transfer",
      title: "Contract offer submitted",
      body: `Offer submitted to ${offer.player.name}. Expected response in ${decisionDays} day(s).`,
      fromName: "General Manager",
    });

    await prisma.negotiationEvent.create({
      data: {
        saveId: dto.saveId,
        entityType: "CONTRACT_OFFER",
        entityId: offer.id,
        eventType: "SUBMITTED",
        actor: "USER",
        day,
        title: "Contract offer submitted",
        body: `${offer.team.shortName} offered ${this.formatMoney(offer.salaryPerYear)} x ${offer.years} to ${offer.player.name}.`,
      },
    });

    return offer;
  }

  async withdrawContractOffer(saveId: number, offerId: number) {
    const save = await this.ensureSave(saveId);
    const offer = await prisma.contractOffer.findFirst({
      where: { id: offerId, saveId },
      include: { player: { select: { name: true } } },
    });
    if (!offer) throw new NotFoundError("Contract offer");
    if (offer.status !== "PENDING") throw new BadRequestError("Only pending offers can be withdrawn");

    const updated = await prisma.contractOffer.update({
      where: { id: offer.id },
      data: { status: "WITHDRAWN", resolvedAt: save.currentDate, decisionReason: "Offer withdrawn by user." },
    });

    await prisma.negotiationEvent.create({
      data: {
        saveId,
        entityType: "CONTRACT_OFFER",
        entityId: offer.id,
        eventType: "WITHDRAWN",
        actor: "USER",
        day: seasonDayFromSave(save),
        title: "Contract offer withdrawn",
        body: `You withdrew your offer to ${offer.player.name}.`,
      },
    });

    return updated;
  }

  async listTradeProposals(saveId: number) {
    await this.ensureSave(saveId);
    const proposals = await prisma.tradeProposal.findMany({
      where: { saveId },
      include: {
        fromTeam: { select: { id: true, name: true, shortName: true } },
        toTeam: { select: { id: true, name: true, shortName: true } },
        items: { include: { player: { select: { id: true, name: true, position: true, salary: true, overallCurrent: true, potential: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return proposals.map((proposal) => ({
      ...proposal,
      items: proposal.items.map((item) => {
        if (!item.player) return item;
        const teamCode = item.direction === "OUT" ? proposal.fromTeam?.shortName : proposal.toTeam?.shortName;
        return {
          ...item,
          player: {
            ...item.player,
            position: resolveDetailedPosition(item.player.name, teamCode ?? "", item.player.position) ?? item.player.position,
            primaryPosition: resolveDetailedPosition(item.player.name, teamCode ?? "", (item.player as any).primaryPosition ?? item.player.position) ?? (item.player as any).primaryPosition ?? item.player.position,
          },
        };
      }),
    }));
  }

  async submitTradeProposal(dto: SubmitTradeProposalDto) {
    const save = await this.ensureSave(dto.saveId);
    const outgoingPlayerIds = [...new Set((dto.outgoingPlayerIds ?? []).map(Number).filter(Number.isFinite))];
    const incomingPlayerIds = [...new Set((dto.incomingPlayerIds ?? []).map(Number).filter(Number.isFinite))];
    if (!outgoingPlayerIds.length || !incomingPlayerIds.length) {
      throw new BadRequestError("Trade proposal requires outgoing and incoming players");
    }

    const validation = await this.capService.validateTradeProposal({
      fromTeamId: dto.fromTeamId,
      toTeamId: dto.toTeamId,
      outgoingPlayerIds,
      incomingPlayerIds,
      cashOut: dto.cashOut,
      cashIn: dto.cashIn,
    });

    const saveDay = seasonDayFromSave(save);
    const responseDays = clamp(Number(dto.responseDays ?? 2), 1, 7);
    const proposal = await prisma.tradeProposal.create({
      data: {
        saveId: dto.saveId,
        fromTeamId: dto.fromTeamId,
        toTeamId: dto.toTeamId,
        status: validation.legal ? "PENDING" : "ILLEGAL",
        submittedDay: saveDay,
        decisionDay: saveDay + responseDays,
        expiresDay: saveDay + Math.max(responseDays + 4, 7),
        cashOut: Math.max(0, Math.round(dto.cashOut ?? 0)),
        cashIn: Math.max(0, Math.round(dto.cashIn ?? 0)),
        validation: validation as any,
        decisionReason: validation.legal ? null : validation.reasons.join(" "),
        items: {
          create: [
            ...outgoingPlayerIds.map((playerId) => ({ itemType: "PLAYER", direction: "OUT", playerId })),
            ...incomingPlayerIds.map((playerId) => ({ itemType: "PLAYER", direction: "IN", playerId })),
          ],
        },
      },
      include: {
        fromTeam: { select: { id: true, name: true, shortName: true } },
        toTeam: { select: { id: true, name: true, shortName: true } },
        items: { include: { player: { select: { id: true, name: true, position: true, salary: true, overallCurrent: true, potential: true } } } },
      },
    });

    await prisma.negotiationEvent.create({
      data: {
        saveId: dto.saveId,
        entityType: "TRADE_PROPOSAL",
        entityId: proposal.id,
        eventType: "SUBMITTED",
        actor: "USER",
        day: saveDay,
        title: validation.legal ? "Trade proposal submitted" : "Illegal trade proposal blocked",
        body: validation.legal
          ? `${proposal.fromTeam.shortName} proposed a deal to ${proposal.toTeam.shortName}.`
          : `Trade flagged illegal: ${validation.reasons.join(" ")}`,
        payload: validation as any,
      },
    });

    if (!validation.legal) {
      await this.createInboxMessage({
        saveId: dto.saveId,
        date: save.currentDate,
        type: "transfer",
        title: "Trade proposal flagged illegal",
        body: validation.reasons.join(" ") || "This move violates cap/salary rules.",
        fromName: "League Office",
      });
    }

    return {
      ...proposal,
      items: proposal.items.map((item) => {
        if (!item.player) return item;
        const teamCode = item.direction === "OUT" ? proposal.fromTeam?.shortName : proposal.toTeam?.shortName;
        return {
          ...item,
          player: {
            ...item.player,
            position: resolveDetailedPosition(item.player.name, teamCode ?? "", item.player.position) ?? item.player.position,
          },
        };
      }),
    };
  }

  async withdrawTradeProposal(saveId: number, proposalId: number) {
    const save = await this.ensureSave(saveId);
    const proposal = await prisma.tradeProposal.findFirst({
      where: { id: proposalId, saveId },
    });
    if (!proposal) throw new NotFoundError("Trade proposal");
    if (!["PENDING", "COUNTERED"].includes(proposal.status)) throw new BadRequestError("Only pending/countered proposals can be withdrawn");
    return prisma.tradeProposal.update({
      where: { id: proposalId },
      data: {
        status: "WITHDRAWN",
        resolvedAt: save.currentDate,
        decisionReason: "Proposal withdrawn by user.",
      },
    });
  }

  async listNegotiationEvents(saveId: number) {
    await this.ensureSave(saveId);
    return prisma.negotiationEvent.findMany({
      where: { saveId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async listTransactionHistory(saveId: number) {
    await this.ensureSave(saveId);
    return prisma.transactionHistory.findMany({
      where: { saveId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async snapshotTeamCapsForDay(saveId: number, day: number) {
    const teams = await prisma.team.findMany({
      where: { shortName: { not: FREE_AGENT_TEAM_SHORT } },
      select: { id: true },
    });
    for (const team of teams) {
      const summary = await this.capService.getTeamCapSummary(team.id);
      await prisma.teamCapSnapshot.upsert({
        where: {
          saveId_teamId_day: {
            saveId,
            teamId: team.id,
            day,
          },
        },
        update: {
          payroll: summary.payroll,
          capSpace: summary.capSpace,
          luxuryTax: summary.luxuryTaxOwed,
          overCap: summary.overCap,
          overTax: summary.overTax,
          hardCap: summary.hardCap,
          apron: summary.apron,
        },
        create: {
          saveId,
          teamId: team.id,
          day,
          payroll: summary.payroll,
          capSpace: summary.capSpace,
          luxuryTax: summary.luxuryTaxOwed,
          overCap: summary.overCap,
          overTax: summary.overTax,
          hardCap: summary.hardCap,
          apron: summary.apron,
        },
      });
    }
  }

  async signFreeAgent(dto: SignFreeAgentDto) {
    const save = await this.ensureSave(dto.saveId);
    const freeAgentTeam = await prisma.team.findUnique({
      where: { shortName: FREE_AGENT_TEAM_SHORT },
      select: { id: true, name: true },
    });
    if (!freeAgentTeam) throw new BadRequestError("Free-agent pool is not initialized");

    const toTeam = await prisma.team.findUnique({
      where: { id: dto.toTeamId },
      select: { id: true, name: true, shortName: true },
    });
    if (!toTeam) throw new NotFoundError("Team");
    if (toTeam.id === freeAgentTeam.id) throw new BadRequestError("Invalid destination club");

    const player = await prisma.player.findUnique({
      where: { id: dto.playerId },
      select: {
        id: true,
        name: true,
        teamId: true,
        salary: true,
        overallCurrent: true,
        overallBase: true,
      },
    });
    if (!player) throw new NotFoundError("Player");
    if (player.teamId !== freeAgentTeam.id) {
      throw new BadRequestError(`${player.name} is not currently a free agent`);
    }

    const years = clamp(Number(dto.years ?? 1), 1, 5);
    const salary = Math.max(500_000, Number(dto.salary ?? player.salary ?? 1_500_000));
    const startYear = Number(String(save.season ?? "2025-26").slice(0, 4)) || new Date().getUTCFullYear();
    const endYear = startYear + years - 1;

    const [updatedPlayer] = await prisma.$transaction([
      prisma.player.update({
        where: { id: player.id },
        data: {
          teamId: toTeam.id,
          salary,
        },
        include: {
          team: { select: { id: true, name: true, shortName: true, logoPath: true } },
        },
      }),
      prisma.contract.upsert({
        where: { playerId: player.id },
        update: {
          teamId: toTeam.id,
          salary,
          currentYearSalary: salary,
          averageAnnualValue: salary,
          startYear,
          endYear,
          contractType: "signed_free_agent",
        },
        create: {
          playerId: player.id,
          teamId: toTeam.id,
          salary,
          currentYearSalary: salary,
          averageAnnualValue: salary,
          startYear,
          endYear,
          contractType: "signed_free_agent",
        },
      }),
    ]);

    await this.createInboxMessage({
      saveId: dto.saveId,
      date: save.currentDate,
      type: "transfer",
      title: "Free agent signed",
      body: `${updatedPlayer.name} signed with ${toTeam.name} (${this.formatMoney(salary)} / year, ${years} year(s)).`,
      fromName: "Sporting Director",
    });

    return updatedPlayer;
  }

  async listOffers(saveId: number) {
    await this.ensureSave(saveId);
    await this.reconcileSaveTransferState(saveId);
    const offers = await prisma.transferOffer.findMany({
      where: { saveId },
      include: {
        fromTeam: { select: { id: true, name: true, shortName: true } },
        toTeam: { select: { id: true, name: true, shortName: true } },
        playerPieces: {
          include: { player: { select: { id: true, name: true, position: true, salary: true } } },
          orderBy: [{ direction: "asc" }, { id: "asc" }],
        },
        transactionLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        contractProposals: {
          include: { player: { select: { id: true, name: true, position: true, salary: true, overallCurrent: true, overallBase: true } } },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return offers.map((offer) => {
      const pieceArrays = this.getOfferPlayerIdsFromPieces(offer.playerPieces);
      return {
        ...offer,
        outgoingPlayerIds: pieceArrays.outgoingPlayerIds.length ? pieceArrays.outgoingPlayerIds : offer.outgoingPlayerIds,
        incomingPlayerIds: pieceArrays.incomingPlayerIds.length ? pieceArrays.incomingPlayerIds : offer.incomingPlayerIds,
        pieceSummary: {
          outgoing: offer.playerPieces.filter((p) => p.direction === "OUT").map((p) => ({
            id: p.playerId,
            name: p.player.name,
            position: resolveDetailedPosition(p.player.name, offer.fromTeam?.shortName ?? "", p.player.position) ?? p.player.position,
            salary: p.player.salary,
          })),
          incoming: offer.playerPieces.filter((p) => p.direction === "IN").map((p) => ({
            id: p.playerId,
            name: p.player.name,
            position: resolveDetailedPosition(p.player.name, offer.toTeam?.shortName ?? "", p.player.position) ?? p.player.position,
            salary: p.player.salary,
          })),
        },
      };
    });
  }

  async createOffer(dto: CreateTransferOfferDto) {
    const save = await this.ensureSave(dto.saveId);
    const outgoingPlayerIds = [...new Set((dto.outgoingPlayerIds ?? []).map(Number).filter(Number.isFinite))];
    const incomingPlayerIds = [...new Set((dto.incomingPlayerIds ?? []).map(Number).filter(Number.isFinite))];
    if (!outgoingPlayerIds.length || !incomingPlayerIds.length) {
      throw new BadRequestError("Offer must include at least one outgoing and one incoming player");
    }
    if (!Number.isFinite(dto.fromTeamId) || !Number.isFinite(dto.toTeamId) || dto.fromTeamId === dto.toTeamId) {
      throw new BadRequestError("Invalid from/to team");
    }

    const [fromTeam, toTeam, players, saveState] = await Promise.all([
      prisma.team.findUnique({ where: { id: dto.fromTeamId } }),
      prisma.team.findUnique({ where: { id: dto.toTeamId } }),
      prisma.player.findMany({
        where: { id: { in: [...outgoingPlayerIds, ...incomingPlayerIds] } },
        select: {
          id: true,
          teamId: true,
          name: true,
          position: true,
          age: true,
          potential: true,
          overallBase: true,
          overallCurrent: true,
          salary: true,
          contracts: { include: { contractYears: true } },
        },
      }),
      prisma.save.findUnique({ where: { id: dto.saveId }, select: { data: true } }),
    ]);
    if (!fromTeam || !toTeam) throw new NotFoundError("Team");

    const overrides = ((saveState?.data ?? {}) as any)?.transferState?.playerTeamOverrides ?? {};
    const byId = new Map(players.map((p) => [p.id, p]));
    for (const playerId of outgoingPlayerIds) {
      const p = byId.get(playerId);
      if (!p) throw new BadRequestError(`Outgoing player ${playerId} not found`);
      const effectiveTeamId = Number(overrides[String(playerId)] ?? p.teamId);
      if (effectiveTeamId !== dto.fromTeamId) throw new BadRequestError(`Outgoing player ${p.name} does not belong to ${fromTeam.shortName}`);
    }
    for (const playerId of incomingPlayerIds) {
      const p = byId.get(playerId);
      if (!p) throw new BadRequestError(`Incoming player ${playerId} not found`);
      const effectiveTeamId = Number(overrides[String(playerId)] ?? p.teamId);
      if (effectiveTeamId !== dto.toTeamId) throw new BadRequestError(`Incoming player ${p.name} does not belong to ${toTeam.shortName}`);
    }

    const duplicatePending = await prisma.transferOffer.findFirst({
      where: {
        saveId: dto.saveId,
        status: { in: ["DRAFT", "SENT", "CLUB_ACCEPTED", "PLAYER_NEGOTIATION"] },
        fromTeamId: dto.fromTeamId,
        toTeamId: dto.toTeamId,
      },
      include: { playerPieces: true },
    });
    if (duplicatePending) {
      const dup = this.getOfferPlayerIdsFromPieces(duplicatePending.playerPieces);
      const sameOutgoing = JSON.stringify([...dup.outgoingPlayerIds].sort((a,b)=>a-b)) === JSON.stringify([...outgoingPlayerIds].sort((a,b)=>a-b));
      const sameIncoming = JSON.stringify([...dup.incomingPlayerIds].sort((a,b)=>a-b)) === JSON.stringify([...incomingPlayerIds].sort((a,b)=>a-b));
      if (sameOutgoing && sameIncoming) {
        throw new BadRequestError("Duplicate pending offer already exists for the same player package");
      }
    }

    const createdDay = seasonDayFromSave(save);
    const delayMin = Number(process.env.TRANSFER_RESOLVE_MIN_DAYS ?? 1);
    const delayMax = Number(process.env.TRANSFER_RESOLVE_MAX_DAYS ?? 3);
    const delay = clamp(Math.round(delayMin + ((hashString(`${save.id}:${createdDay}:${Date.now()}`) % 1000) / 1000) * (Math.max(delayMin, delayMax) - delayMin)), 1, 7);
    const resolveDay = createdDay + delay;

    const offer = await prisma.transferOffer.create({
      data: {
        saveId: dto.saveId,
        fromTeamId: dto.fromTeamId,
        toTeamId: dto.toTeamId,
        outgoingPlayerIds,
        incomingPlayerIds,
        cashOut: Math.max(0, Number(dto.cashOut ?? 0) || 0),
        cashIn: Math.max(0, Number(dto.cashIn ?? 0) || 0),
        sellOnPct: dto.sellOnPct == null ? null : clamp(Number(dto.sellOnPct) || 0, 0, 100),
        status: dto.sendNow ? "SENT" : "DRAFT",
        createdDay,
        resolveDay: dto.sendNow ? resolveDay : createdDay,
        playerPieces: {
          create: [
            ...outgoingPlayerIds.map((playerId) => ({ playerId, side: "FROM", direction: "OUT" })),
            ...incomingPlayerIds.map((playerId) => ({ playerId, side: "TO", direction: "IN" })),
          ],
        },
      },
      include: {
        fromTeam: { select: { id: true, name: true, shortName: true } },
        toTeam: { select: { id: true, name: true, shortName: true } },
        playerPieces: true,
        contractProposals: true,
      },
    });

    await this.logTransferEvent({
      saveId: dto.saveId,
      offerId: offer.id,
      fromTeamId: dto.fromTeamId,
      toTeamId: dto.toTeamId,
      day: createdDay,
      eventType: dto.sendNow ? "OFFER_SENT" : "OFFER_DRAFTED",
      status: offer.status,
      message: dto.sendNow ? `Offer sent to ${toTeam.shortName}` : "Draft created",
      payload: { outgoingPlayerIds, incomingPlayerIds, cashOut: dto.cashOut ?? 0, cashIn: dto.cashIn ?? 0, sellOnPct: dto.sellOnPct ?? null },
    });

    if (dto.sendNow) {
      await this.createInboxMessage({
        saveId: dto.saveId,
        date: save.currentDate,
        type: "transfer",
        title: "Transfer offer sent",
        body: `Offer sent to ${toTeam.name}. Expected response in ${delay} day(s).`,
        fromName: "Sporting Director",
        relatedOfferId: offer.id,
      });
    }

    return offer;
  }

  async sendOffer(saveId: number, offerId: number) {
    const save = await this.ensureSave(saveId);
    const offer = await prisma.transferOffer.findFirst({
      where: { id: offerId, saveId },
      include: {
        fromTeam: true,
        toTeam: true,
        playerPieces: true,
      },
    });
    if (!offer) throw new NotFoundError("Transfer offer");
    if (offer.status !== "DRAFT") throw new BadRequestError("Only draft offers can be sent");

    const currentDay = seasonDayFromSave(save);
    const delay = clamp(1 + (hashString(`${saveId}:${offer.id}:${currentDay}`) % 3), 1, 3);
    const updated = await prisma.transferOffer.update({
      where: { id: offer.id },
      data: {
        status: "SENT",
        createdDay: currentDay,
        resolveDay: currentDay + delay,
      },
      include: {
        fromTeam: { select: { id: true, name: true, shortName: true } },
        toTeam: { select: { id: true, name: true, shortName: true } },
        playerPieces: true,
        contractProposals: true,
      },
    });
    await this.logTransferEvent({
      saveId,
      offerId: offer.id,
      fromTeamId: offer.fromTeamId,
      toTeamId: offer.toTeamId,
      day: currentDay,
      eventType: "OFFER_SENT",
      status: "SENT",
      message: `Offer sent to ${offer.toTeam.shortName}`,
    });

    await this.createInboxMessage({
      saveId,
      date: save.currentDate,
      type: "transfer",
      title: "Transfer offer sent",
      body: `Offer sent to ${offer.toTeam.name}. Expected response in ${delay} day(s).`,
      fromName: "Sporting Director",
      relatedOfferId: offer.id,
    });

    return updated;
  }

  async resolvePendingOffersForDay(saveId: number, day: number, date: Date) {
    const pending = await prisma.transferOffer.findMany({
      where: {
        saveId,
        status: "SENT",
        resolveDay: { lte: day },
      },
      orderBy: { createdAt: "asc" },
      include: {
        fromTeam: true,
        toTeam: true,
        playerPieces: true,
      },
    });

    for (const offer of pending) {
      const pieceArrays = this.getOfferPlayerIdsFromPieces(offer.playerPieces);
      const offerForEval = {
        ...offer,
        outgoingPlayerIds: pieceArrays.outgoingPlayerIds.length ? pieceArrays.outgoingPlayerIds : offer.outgoingPlayerIds,
        incomingPlayerIds: pieceArrays.incomingPlayerIds.length ? pieceArrays.incomingPlayerIds : offer.incomingPlayerIds,
      };
      const evaluation = await this.evaluateOffer(offerForEval);
      let nextStatus = evaluation.accepted ? "CLUB_ACCEPTED" : "CLUB_REJECTED";
      await prisma.transferOffer.update({
        where: { id: offer.id },
        data: {
          status: nextStatus,
          aiReason: evaluation.reason,
          resolvedAt: date,
        },
      });
      await this.createInboxMessage({
        saveId,
        date,
        type: "transfer",
        title: evaluation.accepted ? "Club accepted your offer" : "Club rejected your offer",
        body: `${offer.toTeam.name}: ${evaluation.reason}`,
        fromName: offer.toTeam.name,
        relatedOfferId: offer.id,
      });
      await this.logTransferEvent({
        saveId,
        offerId: offer.id,
        fromTeamId: offer.fromTeamId,
        toTeamId: offer.toTeamId,
        day,
        eventType: "CLUB_DECISION",
        status: nextStatus,
        message: evaluation.reason,
      });
      if (evaluation.accepted) {
        const created = await this.createAgentCounterProposals(offer.id, saveId, date, day);
        nextStatus = created > 0 ? "PLAYER_NEGOTIATION" : "CLUB_ACCEPTED";
      }
    }

    return pending.length;
  }

  async respondToPlayerProposal(dto: PlayerProposalResponseDto) {
    const save = await this.ensureSave(dto.saveId);
    const proposal = await prisma.playerContractProposal.findUnique({
      where: { id: dto.proposalId },
      include: {
        player: true,
        offer: {
          include: {
            fromTeam: true,
            toTeam: true,
            contractProposals: true,
          },
        },
      },
    });
    if (!proposal || proposal.offer.saveId !== dto.saveId) throw new NotFoundError("Player contract proposal");
    if (!["COUNTERED", "OFFERED"].includes(proposal.status)) throw new BadRequestError("Proposal is not actionable");

    const today = seasonDayFromSave(save);
    const action = dto.action;

    if (action === "DECLINE") {
      await prisma.$transaction([
        prisma.playerContractProposal.update({
          where: { id: proposal.id },
          data: { status: "REJECTED" },
        }),
        prisma.transferOffer.update({
          where: { id: proposal.offerId },
          data: { status: "FAILED", aiReason: "Manager declined player/agent terms." },
        }),
      ]);
      await this.logTransferEvent({
        saveId: dto.saveId,
        offerId: proposal.offerId,
        fromTeamId: proposal.offer.fromTeamId,
        toTeamId: proposal.offer.toTeamId,
        day: today,
        eventType: "MANAGER_DECLINED_TERMS",
        status: "FAILED",
        message: `Manager declined ${proposal.player.name} terms`,
      });
      await this.createInboxMessage({
        saveId: dto.saveId,
        date: save.currentDate,
        type: "transfer",
        title: "Transfer cancelled",
        body: `You declined ${proposal.player.name}'s contract terms.`,
        fromName: "Sporting Director",
        relatedOfferId: proposal.offerId,
      });
      return { success: true };
    }

    const sendSalary = action === "ACCEPT"
      ? proposal.proposedSalary
      : Math.max(500_000, Number(dto.proposedSalary ?? proposal.proposedSalary));
    const sendYears = action === "ACCEPT"
      ? proposal.years
      : clamp(Number(dto.years ?? proposal.years), 1, 5);
    const sendRole = String(dto.role ?? proposal.role ?? "rotation");
    const responseDelay = clamp(1 + (hashString(`${dto.saveId}:${proposal.id}:${today}:${action}`) % 2), 1, 2);

    await prisma.playerContractProposal.update({
      where: { id: proposal.id },
      data: {
        proposedSalary: sendSalary,
        years: sendYears,
        role: sendRole,
        responseDeadlineDay: today + responseDelay,
        status: "OFFERED",
      },
    });
    await this.logTransferEvent({
      saveId: dto.saveId,
      offerId: proposal.offerId,
      fromTeamId: proposal.offer.fromTeamId,
      toTeamId: proposal.offer.toTeamId,
      day: today,
      eventType: action === "NEGOTIATE" ? "MANAGER_COUNTERED_AGENT" : "MANAGER_ACCEPTED_AGENT_TERMS",
      status: "OFFERED",
      message: `${proposal.player.name}: ${this.formatMoney(sendSalary)} x ${sendYears} (${sendRole})`,
      payload: { proposalId: proposal.id, proposedSalary: sendSalary, years: sendYears, role: sendRole },
    });

    await this.createInboxMessage({
      saveId: dto.saveId,
      date: save.currentDate,
      type: "transfer",
      title: action === "ACCEPT" ? "Terms submitted to player" : "Counter-offer sent to agent",
      body: `${proposal.player.name}'s camp will respond in ${responseDelay} day(s).`,
      fromName: "Sporting Director",
      relatedOfferId: proposal.offerId,
    });

    return { success: true };
  }

  async resolvePendingPlayerProposalResponsesForDay(saveId: number, day: number, date: Date) {
    const proposals = await prisma.playerContractProposal.findMany({
      where: {
        offer: { saveId },
        status: "OFFERED",
        responseDeadlineDay: { lte: day },
      },
      include: {
        player: true,
        offer: {
          include: {
            fromTeam: true,
            toTeam: true,
            contractProposals: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    for (const proposal of proposals) {
      const decision = await this.evaluatePlayerContractResponse(proposal, saveId);
      await prisma.playerContractProposal.update({
        where: { id: proposal.id },
        data: { status: decision.accepted ? "ACCEPTED" : "REJECTED" },
      });

      await this.createInboxMessage({
        saveId,
        date,
        type: "transfer",
        title: decision.accepted ? "Player accepted contract terms" : "Player rejected contract terms",
        body: `${proposal.player.name}: ${decision.reason}`,
        fromName: "Agent",
        relatedOfferId: proposal.offerId,
      });

      if (!decision.accepted) {
        await prisma.transferOffer.update({
          where: { id: proposal.offerId },
          data: { status: "FAILED", aiReason: decision.reason },
        });
        await this.logTransferEvent({
          saveId,
          offerId: proposal.offerId,
          fromTeamId: proposal.offer.fromTeamId,
          toTeamId: proposal.offer.toTeamId,
          day,
          eventType: "PLAYER_DECISION",
          status: "FAILED",
          message: `${proposal.player.name}: ${decision.reason}`,
        });
        continue;
      }

      const latest = await prisma.transferOffer.findUnique({
        where: { id: proposal.offerId },
        include: { contractProposals: true },
      });
      if (!latest) continue;
      const statuses = latest.contractProposals.map((p) => p.status);
      if (statuses.length > 0 && statuses.every((s) => s === "ACCEPTED")) {
        await this.applyCompletedTransferToSaveState({
          saveId,
          offerId: latest.id,
          fromTeamId: latest.fromTeamId,
          toTeamId: latest.toTeamId,
          outgoingPlayerIds: latest.outgoingPlayerIds,
          incomingPlayerIds: latest.incomingPlayerIds,
          date,
        });
        await prisma.transferOffer.update({
          where: { id: latest.id },
          data: {
            status: "COMPLETED",
            aiReason: `${latest.aiReason ?? "Club accepted."} Player terms accepted. Save roster execution applied.`,
          },
        });
        await this.logTransferEvent({
          saveId,
          offerId: latest.id,
          fromTeamId: latest.fromTeamId,
          toTeamId: latest.toTeamId,
          day,
          eventType: "TRANSFER_COMPLETED",
          status: "COMPLETED",
          message: "All player terms accepted; save-scoped roster execution applied",
        });
        await this.createInboxMessage({
          saveId,
          date,
          type: "transfer",
          title: "Transfer terms agreed",
          body: "All player/agent terms accepted. The transfer has been applied to this save's roster state.",
          fromName: "Sporting Director",
          relatedOfferId: latest.id,
        });
      }
    }

    return proposals.length;
  }

  async resolvePendingContractOffersForDay(saveId: number, day: number, date: Date) {
    const pending = await prisma.contractOffer.findMany({
      where: { saveId, status: "PENDING", decisionDay: { lte: day } },
      include: {
        player: { include: { team: true } },
        team: true,
      },
      orderBy: { createdAt: "asc" },
    });
    if (pending.length === 0) return 0;

    const save = await this.ensureSave(saveId);
    const teamSummaryCache = new Map<number, Awaited<ReturnType<CapService["getTeamCapSummary"]>>>();
    const getTeamSummary = async (teamId: number) => {
      if (!teamSummaryCache.has(teamId)) {
        teamSummaryCache.set(teamId, await this.capService.getTeamCapSummary(teamId));
      }
      return teamSummaryCache.get(teamId)!;
    };

    const freeAgentTeam = await prisma.team.findUnique({ where: { shortName: FREE_AGENT_TEAM_SHORT }, select: { id: true } });
    for (const offer of pending) {
      const teamSummary = await getTeamSummary(offer.teamId);
      const expected = Math.max(500_000, Number(offer.expectedSalary ?? 1_500_000));
      const salaryFactor = clamp((offer.salaryPerYear - expected) / Math.max(1, expected), -0.6, 1.2);
      const roleFactor = offer.rolePromise === "star" ? 0.2 : offer.rolePromise === "starter" ? 0.12 : offer.rolePromise === "bench" ? -0.06 : 0;
      const teamQuality = clamp(((teamSummary.payroll / Math.max(1, teamSummary.salaryCap)) - 0.8) * 0.2, -0.1, 0.12);
      const playtimeFactor = offer.rolePromise === "star" ? 0.15 : offer.rolePromise === "starter" ? 0.08 : 0;
      const contenderFactor = teamSummary.overTax ? 0.04 : 0;
      const capFactor = teamSummary.capSpace >= offer.salaryPerYear ? 0.04 : -0.1;
      const seed = hashString(`${saveId}:${offer.id}:${day}:fa`);
      const rng = mulberry32(seed);
      const randomness = (rng() - 0.5) * 0.28;
      const interestScore = salaryFactor + roleFactor + teamQuality + playtimeFactor + contenderFactor + capFactor + randomness;
      const accepted = interestScore >= 0.05;
      const decisionReason = accepted
        ? `Accepted. Salary/role fit expectations (score ${interestScore.toFixed(2)}).`
        : `Rejected. Expected better salary/role situation (score ${interestScore.toFixed(2)}).`;

      if (!accepted) {
        await prisma.contractOffer.update({
          where: { id: offer.id },
          data: { status: "REJECTED", interestScore, decisionReason, resolvedAt: date },
        });
        await this.createInboxMessage({
          saveId,
          date,
          type: "transfer",
          title: "Contract offer rejected",
          body: `${offer.player.name} rejected your offer. ${decisionReason}`,
          fromName: "Player Agent",
        });
        await prisma.negotiationEvent.create({
          data: {
            saveId,
            entityType: "CONTRACT_OFFER",
            entityId: offer.id,
            eventType: "REJECTED",
            actor: "PLAYER_AGENT",
            day,
            title: "Offer rejected",
            body: decisionReason,
          },
        });
        continue;
      }

      const years = clamp(Number(offer.years), 1, 5);
      const seasonStart = Number(String(save.season ?? "2025-26").slice(0, 4)) || new Date().getUTCFullYear();
      const endYear = seasonStart + years - 1;
      await prisma.$transaction([
        prisma.contractOffer.update({
          where: { id: offer.id },
          data: { status: "ACCEPTED", interestScore, decisionReason, resolvedAt: date },
        }),
        prisma.player.update({
          where: { id: offer.playerId },
          data: {
            teamId: offer.teamId,
            salary: offer.salaryPerYear,
          },
        }),
        prisma.contract.upsert({
          where: { playerId: offer.playerId },
          update: {
            teamId: offer.teamId,
            salary: offer.salaryPerYear,
            currentYearSalary: offer.salaryPerYear,
            averageAnnualValue: offer.salaryPerYear,
            startYear: seasonStart,
            endYear,
            contractType: "signed_free_agent",
            optionType: offer.optionType ?? null,
          },
          create: {
            playerId: offer.playerId,
            teamId: offer.teamId,
            salary: offer.salaryPerYear,
            currentYearSalary: offer.salaryPerYear,
            averageAnnualValue: offer.salaryPerYear,
            startYear: seasonStart,
            endYear,
            contractType: "signed_free_agent",
            optionType: offer.optionType ?? null,
          },
        }),
        prisma.transactionHistory.create({
          data: {
            saveId,
            teamId: offer.teamId,
            category: "FREE_AGENCY",
            status: "COMPLETED",
            referenceType: "CONTRACT_OFFER",
            referenceId: offer.id,
            day,
            title: "Free agent signed",
            body: `${offer.player.name} signed for ${this.formatMoney(offer.salaryPerYear)} x ${offer.years}.`,
            payload: { offerId: offer.id, playerId: offer.playerId, freeAgentTeamId: freeAgentTeam?.id ?? null } as any,
          },
        }),
      ]);

      await this.createInboxMessage({
        saveId,
        date,
        type: "transfer",
        title: "Contract offer accepted",
        body: `${offer.player.name} accepted your offer (${this.formatMoney(offer.salaryPerYear)} x ${offer.years}).`,
        fromName: "Player Agent",
      });
      await prisma.negotiationEvent.create({
        data: {
          saveId,
          entityType: "CONTRACT_OFFER",
          entityId: offer.id,
          eventType: "ACCEPTED",
          actor: "PLAYER_AGENT",
          day,
          title: "Offer accepted",
          body: decisionReason,
        },
      });
    }

    return pending.length;
  }

  async resolvePendingTradeProposalsForDay(saveId: number, day: number, date: Date) {
    const proposals = await prisma.tradeProposal.findMany({
      where: { saveId, status: "PENDING", decisionDay: { lte: day } },
      include: {
        fromTeam: true,
        toTeam: true,
        items: { include: { player: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    for (const proposal of proposals) {
      const outgoing = proposal.items.filter((i) => i.itemType === "PLAYER" && i.direction === "OUT").map((i) => i.player).filter(Boolean) as any[];
      const incoming = proposal.items.filter((i) => i.itemType === "PLAYER" && i.direction === "IN").map((i) => i.player).filter(Boolean) as any[];
      const outgoingValue = outgoing.reduce((s, p) => s + (p.overallCurrent ?? p.overallBase ?? 60) + ((p.potential ?? 70) - (p.overallCurrent ?? 60)) * 0.2, 0);
      const incomingValue = incoming.reduce((s, p) => s + (p.overallCurrent ?? p.overallBase ?? 60) + ((p.potential ?? 70) - (p.overallCurrent ?? 60)) * 0.2, 0);
      const valueDiff = incomingValue - outgoingValue;
      const positionFit = this.computeTradeFitBonus(outgoing, incoming);
      const contractFactor = incoming.reduce((s, p) => s + ((p.salary ?? 0) > 30_000_000 ? -2 : 1), 0);
      const directionFactor = (proposal.toTeam.form ?? 50) >= 55 ? -1 : 1;
      const seed = hashString(`${saveId}:${proposal.id}:${day}:trade`);
      const rng = mulberry32(seed);
      const randomness = (rng() - 0.5) * 8;
      const acceptanceScore = valueDiff + positionFit + contractFactor + directionFactor + randomness;

      let status: string = "REJECTED";
      let reason = `Rejected. Offer value/fit too low (score ${acceptanceScore.toFixed(1)}).`;
      let counterPayload: any = null;

      if (acceptanceScore >= 4) {
        status = "ACCEPTED";
        reason = `Accepted. Offer met team value and fit (score ${acceptanceScore.toFixed(1)}).`;
      } else if (acceptanceScore >= 0.5) {
        status = "COUNTERED";
        const extra = outgoing.sort((a, b) => (a.overallCurrent ?? 0) - (b.overallCurrent ?? 0))[0];
        counterPayload = {
          askAdditionalOutgoingPlayerId: extra?.id ?? null,
          askAdditionalCashOut: 1_000_000,
        };
        reason = "Countered. Team wants slightly better outgoing value.";
      }

      await prisma.tradeProposal.update({
        where: { id: proposal.id },
        data: {
          status,
          aiScore: acceptanceScore,
          decisionReason: reason,
          counterPayload: counterPayload as any,
          resolvedAt: status === "COUNTERED" ? null : date,
        },
      });

      if (status === "ACCEPTED") {
        await this.executeAcceptedTradeProposal(saveId, proposal.id, day, date);
      }

      await this.createInboxMessage({
        saveId,
        date,
        type: "transfer",
        title: `Trade ${status.toLowerCase()}`,
        body: `${proposal.toTeam.shortName} ${status.toLowerCase()} your proposal. ${reason}`,
        fromName: "League Office",
      });
      await prisma.negotiationEvent.create({
        data: {
          saveId,
          entityType: "TRADE_PROPOSAL",
          entityId: proposal.id,
          eventType: status,
          actor: "AI_TEAM",
          day,
          title: `Trade ${status.toLowerCase()}`,
          body: reason,
          payload: counterPayload as any,
        },
      });
    }
    return proposals.length;
  }

  private async executeAcceptedTradeProposal(saveId: number, proposalId: number, day: number, date: Date) {
    const proposal = await prisma.tradeProposal.findUnique({
      where: { id: proposalId },
      include: { items: true, fromTeam: true, toTeam: true },
    });
    if (!proposal) return;
    const outgoing = proposal.items.filter((i) => i.itemType === "PLAYER" && i.direction === "OUT").map((i) => i.playerId).filter((v): v is number => v != null);
    const incoming = proposal.items.filter((i) => i.itemType === "PLAYER" && i.direction === "IN").map((i) => i.playerId).filter((v): v is number => v != null);

    const movingIds = [...new Set([...outgoing, ...incoming])];
    const movingPlayers = await prisma.player.findMany({
      where: { id: { in: movingIds } },
      select: { id: true, jerseyCode: true },
    });
    const jerseyByPlayerId = new Map(movingPlayers.map((p) => [p.id, p.jerseyCode ?? null]));

    const fromTeamKeepers = await prisma.player.findMany({
      where: {
        active: true,
        teamId: proposal.fromTeamId,
        id: { notIn: outgoing },
      },
      select: { jerseyCode: true },
    });
    const toTeamKeepers = await prisma.player.findMany({
      where: {
        active: true,
        teamId: proposal.toTeamId,
        id: { notIn: incoming },
      },
      select: { jerseyCode: true },
    });
    const normalizeJersey = (value: string | null | undefined) => {
      const v = String(value ?? "").trim();
      return v.length > 0 ? v : null;
    };
    const reserveJerseys = (
      preferredByPlayer: Array<{ playerId: number; preferred: string | null }>,
      existing: string[],
    ) => {
      const used = new Set(existing.map((v) => String(v)));
      const assignments = new Map<number, string | null>();
      const nextFree = () => {
        const candidates = ["0", "00", ...Array.from({ length: 99 }, (_, i) => String(i + 1))];
        for (const c of candidates) {
          if (!used.has(c)) return c;
        }
        return null;
      };
      for (const row of preferredByPlayer) {
        const preferred = normalizeJersey(row.preferred);
        if (preferred && !used.has(preferred)) {
          used.add(preferred);
          assignments.set(row.playerId, preferred);
          continue;
        }
        const fallback = nextFree();
        if (fallback) {
          used.add(fallback);
          assignments.set(row.playerId, fallback);
        } else {
          assignments.set(row.playerId, null);
        }
      }
      return assignments;
    };
    const toTeamAssignments = reserveJerseys(
      outgoing.map((playerId) => ({ playerId, preferred: jerseyByPlayerId.get(playerId) ?? null })),
      toTeamKeepers.map((p) => normalizeJersey(p.jerseyCode)).filter(Boolean) as string[],
    );
    const fromTeamAssignments = reserveJerseys(
      incoming.map((playerId) => ({ playerId, preferred: jerseyByPlayerId.get(playerId) ?? null })),
      fromTeamKeepers.map((p) => normalizeJersey(p.jerseyCode)).filter(Boolean) as string[],
    );

    await prisma.$transaction([
      ...outgoing.map((playerId) =>
        prisma.player.update({
          where: { id: playerId },
          data: { teamId: proposal.toTeamId, jerseyCode: toTeamAssignments.get(playerId) ?? null },
        })),
      ...incoming.map((playerId) =>
        prisma.player.update({
          where: { id: playerId },
          data: { teamId: proposal.fromTeamId, jerseyCode: fromTeamAssignments.get(playerId) ?? null },
        })),
      prisma.transactionHistory.create({
        data: {
          saveId,
          teamId: proposal.fromTeamId,
          category: "TRADE",
          status: "COMPLETED",
          referenceType: "TRADE_PROPOSAL",
          referenceId: proposal.id,
          day,
          title: "Trade completed",
          body: `${proposal.fromTeam.shortName} and ${proposal.toTeam.shortName} completed a trade.`,
          payload: { outgoingPlayerIds: outgoing, incomingPlayerIds: incoming } as any,
        },
      }),
    ]);
  }

  private computeTradeFitBonus(outgoing: Array<{ position?: string | null }>, incoming: Array<{ position?: string | null }>) {
    const count = (arr: Array<{ position?: string | null }>) => arr.reduce((acc, p) => {
      const b = parsePosBucket(p.position);
      acc[b] += 1;
      return acc;
    }, { G: 0, W: 0, B: 0 } as Record<"G" | "W" | "B", number>);
    const out = count(outgoing);
    const inn = count(incoming);
    return (inn.G - out.G) * 0.6 + (inn.W - out.W) * 0.8 + (inn.B - out.B) * 1.0;
  }

  private async evaluateOffer(offer: {
    id: number;
    saveId: number;
    fromTeamId: number;
    toTeamId: number;
    outgoingPlayerIds: number[];
    incomingPlayerIds: number[];
    cashOut: number;
    cashIn: number;
    fromTeam: { name: string; shortName: string };
    toTeam: { name: string; shortName: string };
  }): Promise<{ accepted: boolean; reason: string }> {
    const players = await prisma.player.findMany({
      where: { id: { in: [...offer.outgoingPlayerIds, ...offer.incomingPlayerIds] } },
      include: {
        contracts: { include: { contractYears: true } },
      },
    });
    type PlayerRow = (typeof players)[number];
    const byId = new Map(players.map((p) => [p.id, p]));
    const toTeamRoster = await prisma.player.findMany({
      where: { teamId: offer.toTeamId, active: true },
      select: { position: true, overallBase: true, overallCurrent: true },
    });

    const posCounts = { G: 0, W: 0, B: 0 };
    for (const p of toTeamRoster) posCounts[parsePosBucket(p.position)] += 1;

    const needScore = (player: PlayerRow, direction: "incoming" | "outgoing") => {
      const bucket = parsePosBucket(player.position);
      const count = posCounts[bucket];
      const scarcity = bucket === "B" ? 4 - count : 6 - count;
      const sign = direction === "incoming" ? 1 : -1;
      return sign * clamp(scarcity, -3, 3) * 3;
    };

    const contractSignal = (player: PlayerRow) => {
      const years = (player.contracts?.contractYears ?? []).length;
      const expiresSoon = years <= 1 ? -4 : years >= 3 ? 2 : 0;
      const salary = player.salary ?? player.contracts?.currentYearSalary ?? 0;
      const salaryPenalty = salary > 45000000 ? -4 : salary > 30000000 ? -2 : 0;
      return expiresSoon + salaryPenalty;
    };

    const playerValue = (player: PlayerRow, direction: "incoming" | "outgoing") => {
      const current = player.overallCurrent ?? player.overallBase ?? player.overall ?? 60;
      const age = player.age ?? 27;
      const ageCurve = age <= 24 ? 4 : age <= 29 ? 2 : age <= 32 ? 0 : -3;
      const potential = ((player.potential ?? current) - current) * 0.25;
      return current + ageCurve + potential + contractSignal(player) + needScore(player, direction);
    };

    const incoming = offer.incomingPlayerIds.map((id) => byId.get(id)).filter(Boolean) as PlayerRow[];
    const outgoing = offer.outgoingPlayerIds.map((id) => byId.get(id)).filter(Boolean) as PlayerRow[];
    const incomingValue = incoming.reduce((s, p) => s + playerValue(p, "incoming"), 0) + (offer.cashIn ?? 0) / 2_000_000;
    const outgoingValue = outgoing.reduce((s, p) => s + playerValue(p, "outgoing"), 0) + (offer.cashOut ?? 0) / 2_000_000;
    const diff = incomingValue - outgoingValue; // value for target club (toTeam)

    const salaryIncoming = incoming.reduce((s, p) => s + (p.salary ?? 0), 0) + (offer.cashIn ?? 0);
    const salaryOutgoing = outgoing.reduce((s, p) => s + (p.salary ?? 0), 0) + (offer.cashOut ?? 0);
    const salaryDelta = salaryIncoming - salaryOutgoing;
    const salaryPenalty = salaryDelta > 15_000_000 ? -8 : salaryDelta > 5_000_000 ? -3 : 0;

    const save = await prisma.save.findUnique({ where: { id: offer.saveId }, select: { season: true } });
    const seedBase = process.env.TRANSFER_TEST_SEED
      ? hashString(`${process.env.TRANSFER_TEST_SEED}:${offer.id}`)
      : hashString(`${offer.saveId}:${offer.id}:${save?.season ?? ""}`);
    const rng = mulberry32(seedBase);
    const noise = (rng() - 0.5) * 8;

    const score = diff + salaryPenalty + noise;
    const accepted = score >= 1;
    const reason = accepted
      ? `Accepted: value favored us (${diff.toFixed(1)}), roster fit and contract profile were acceptable.`
      : `Rejected: package value/fit was short (${diff.toFixed(1)}), salary impact ${salaryDelta >= 0 ? "too costly" : "not enough relief"}.`;

    return { accepted, reason };
  }

  private async createAgentCounterProposals(offerId: number, saveId: number, date: Date, day: number) {
    const offer = await prisma.transferOffer.findUnique({
      where: { id: offerId },
      include: {
        fromTeam: true,
        toTeam: true,
        playerPieces: true,
      },
    });
    if (!offer) return 0;
    const pieceArrays = this.getOfferPlayerIdsFromPieces(offer.playerPieces);

    const incomingPlayers = await prisma.player.findMany({
      where: { id: { in: pieceArrays.incomingPlayerIds.length ? pieceArrays.incomingPlayerIds : offer.incomingPlayerIds } },
      include: { contracts: { include: { contractYears: true } } },
    });
    if (incomingPlayers.length === 0) return 0;

    const created = [];
    for (const player of incomingPlayers) {
      const baseSalary = player.salary ?? player.contracts?.currentYearSalary ?? 1_500_000;
      const seed = hashString(`${saveId}:${offerId}:${player.id}:${day}:agent`);
      const rng = mulberry32(seed);
      const askMultiplier = 1.03 + rng() * 0.22;
      const proposedSalary = Math.round(baseSalary * askMultiplier);
      const years = clamp(Math.round(2 + rng() * 2), 1, 5);
      const role = (player.overallCurrent ?? player.overallBase ?? player.overall ?? 60) >= 80 ? "starter" : "rotation";
      created.push(prisma.playerContractProposal.create({
        data: {
          offerId,
          playerId: player.id,
          proposedSalary,
          years,
          role,
          responseDeadlineDay: day + 7,
          status: "COUNTERED",
        },
      }));

      await this.createInboxMessage({
        saveId,
        date,
        type: "transfer",
        title: "Agent requests contract terms",
        body: `${player.name}'s agent requests ${this.formatMoney(proposedSalary)} for ${years} year(s) as ${role}.`,
        fromName: `${player.name} Agent`,
        relatedOfferId: offerId,
      });
    }
    if (created.length > 0) await prisma.$transaction(created);

    await prisma.transferOffer.update({
      where: { id: offerId },
      data: { status: "PLAYER_NEGOTIATION" },
    });
    await this.logTransferEvent({
      saveId,
      offerId,
      fromTeamId: offer.fromTeamId,
      toTeamId: offer.toTeamId,
      day,
      eventType: "AGENT_NEGOTIATION_STARTED",
      status: "PLAYER_NEGOTIATION",
      message: `Created ${created.length} player contract proposal(s)`,
    });
    await this.createInboxMessage({
      saveId,
      date,
      type: "transfer",
      title: "Club accepted – agent negotiations started",
      body: `${offer.toTeam.name} accepted the club offer. Review agent terms before the deadline.`,
      fromName: "Sporting Director",
      relatedOfferId: offerId,
    });

    return created.length;
  }

  private async evaluatePlayerContractResponse(
    proposal: {
      id: number;
      proposedSalary: number;
      years: number;
      role: string;
      player: { id: number; name: string; salary: number | null; overallCurrent: number; overallBase: number; morale: number; age: number | null };
      offer: { id: number; toTeam: { shortName: string }; fromTeam: { shortName: string } };
    },
    saveId: number,
  ) {
    const baseSalary = proposal.player.salary ?? 1_500_000;
    const salaryRatio = proposal.proposedSalary / Math.max(1, baseSalary);
    const roleBonus = proposal.role === "starter" ? 0.08 : proposal.role === "bench" ? -0.04 : 0.02;
    const age = proposal.player.age ?? 27;
    const ageBonus = age <= 25 ? 0.02 : age >= 32 ? -0.02 : 0;
    const valueSignal = (salaryRatio - 1) * 0.7 + roleBonus + ageBonus;
    const seedBase = process.env.TRANSFER_TEST_SEED
      ? hashString(`${process.env.TRANSFER_TEST_SEED}:player:${proposal.id}`)
      : hashString(`${saveId}:${proposal.offer.id}:player:${proposal.id}`);
    const rng = mulberry32(seedBase);
    const noise = (rng() - 0.5) * 0.12;
    const acceptProb = clamp(0.35 + valueSignal + noise, 0.05, 0.95);
    const accepted = rng() < acceptProb;
    const reason = accepted
      ? `Accepted terms (${this.formatMoney(proposal.proposedSalary)} x ${proposal.years}) and role ${proposal.role} fit expectations.`
      : `Rejected terms (${this.formatMoney(proposal.proposedSalary)} x ${proposal.years}); salary/role did not meet market expectations.`;
    return { accepted, reason };
  }

  private async ensureSave(saveId: number) {
    const save = await prisma.save.findUnique({ where: { id: saveId } });
    if (!save) throw new NotFoundError("Save");
    return save;
  }

  private async createInboxMessage(params: {
    saveId: number;
    date: Date;
    type: string;
    title: string;
    body: string;
    fromName: string;
    relatedOfferId?: number;
  }) {
    return prisma.inboxMessage.create({
      data: {
        saveId: params.saveId,
        date: params.date,
        type: params.type,
        title: params.title,
        body: params.body,
        fromName: params.fromName,
        relatedOfferId: params.relatedOfferId ?? null,
        isRead: false,
      },
    });
  }

  private formatMoney(value: number) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  private async reconcileSaveTransferState(saveId: number) {
    const [save, completedOffers] = await Promise.all([
      prisma.save.findUnique({ where: { id: saveId }, select: { data: true, season: true } }),
      prisma.transferOffer.findMany({
        where: { saveId, status: "COMPLETED" },
        select: {
          id: true,
          fromTeamId: true,
          toTeamId: true,
          outgoingPlayerIds: true,
          incomingPlayerIds: true,
          playerPieces: {
            select: { playerId: true, direction: true },
          },
          resolvedAt: true,
          createdAt: true,
        },
        orderBy: [{ id: "asc" }],
      }),
    ]);
    if (!save || completedOffers.length === 0) return;

    const data = ((save.data ?? {}) as any) || {};
    const current = data.transferState ?? {};
    const currentOverrides = current.playerTeamOverrides ?? {};
    const existingTransactions = Array.isArray(current.transactions) ? current.transactions : [];
    const existingOfferIds = new Set(existingTransactions.map((t: any) => Number(t?.offerId)).filter(Number.isFinite));

    let changed = false;
    const nextOverrides: Record<string, number> = { ...currentOverrides };
    const nextTransactions = [...existingTransactions];

    const seasonStartYear = Number(String(save.season ?? "2025-26").slice(0, 4)) || 2025;
    const seasonStart = new Date(Date.UTC(seasonStartYear, 9, 1));

    for (const offer of completedOffers) {
      const shouldBackfill = !existingOfferIds.has(offer.id);

      // Always recompute override end-state from completed offers (id order), so corrupted/missing state self-heals.
      const pieceArrays = this.getOfferPlayerIdsFromPieces(offer.playerPieces ?? []);
      const outgoing = pieceArrays.outgoingPlayerIds.length ? pieceArrays.outgoingPlayerIds : offer.outgoingPlayerIds;
      const incoming = pieceArrays.incomingPlayerIds.length ? pieceArrays.incomingPlayerIds : offer.incomingPlayerIds;
      for (const playerId of outgoing) nextOverrides[String(playerId)] = offer.toTeamId;
      for (const playerId of incoming) nextOverrides[String(playerId)] = offer.fromTeamId;

      if (shouldBackfill) {
        const when = offer.resolvedAt ?? offer.createdAt;
        const day = Math.max(0, Math.floor((when.getTime() - seasonStart.getTime()) / 86400000));
        nextTransactions.push({
          offerId: offer.id,
          day,
          date: when.toISOString().slice(0, 10),
          fromTeamId: offer.fromTeamId,
          toTeamId: offer.toTeamId,
          outgoingPlayerIds: outgoing,
          incomingPlayerIds: incoming,
          status: "COMPLETED",
        });
        changed = true;
      }
    }

    const overridesChanged = JSON.stringify(currentOverrides) !== JSON.stringify(nextOverrides);
    if (overridesChanged) changed = true;
    if (!changed) return;

    data.transferState = {
      playerTeamOverrides: nextOverrides,
      transactions: nextTransactions,
    };

    await prisma.save.update({
      where: { id: saveId },
      data: { data: data as any },
    });
  }

  private async applyCompletedTransferToSaveState(params: {
    saveId: number;
    offerId: number;
    fromTeamId: number;
    toTeamId: number;
    outgoingPlayerIds: number[];
    incomingPlayerIds: number[];
    date: Date;
  }) {
    const save = await prisma.save.findUnique({ where: { id: params.saveId }, select: { data: true, season: true } });
    if (!save) return;
    const data = (save.data ?? {}) as {
      currentDate?: string;
      transferState?: {
        playerTeamOverrides?: Record<string, number>;
        transactions?: Array<Record<string, unknown>>;
      };
    };
    data.transferState = data.transferState ?? {};
    data.transferState.playerTeamOverrides = data.transferState.playerTeamOverrides ?? {};
    data.transferState.transactions = data.transferState.transactions ?? [];

    for (const playerId of params.outgoingPlayerIds) {
      data.transferState.playerTeamOverrides[String(playerId)] = params.toTeamId;
    }
    for (const playerId of params.incomingPlayerIds) {
      data.transferState.playerTeamOverrides[String(playerId)] = params.fromTeamId;
    }

    const startYear = Number(String(save.season ?? "2025-26").slice(0, 4)) || params.date.getUTCFullYear();
    const seasonStart = new Date(Date.UTC(startYear, 9, 1));
    const day = Math.max(0, Math.floor((params.date.getTime() - seasonStart.getTime()) / 86400000));

    data.transferState.transactions.push({
      offerId: params.offerId,
      day,
      date: params.date.toISOString().slice(0, 10),
      fromTeamId: params.fromTeamId,
      toTeamId: params.toTeamId,
      outgoingPlayerIds: params.outgoingPlayerIds,
      incomingPlayerIds: params.incomingPlayerIds,
      status: "COMPLETED",
    });

    await prisma.save.update({
      where: { id: params.saveId },
      data: { data: data as any },
    });
  }

  private getOfferPlayerIdsFromPieces(pieces: Array<{ playerId: number; direction: string }>) {
    const outgoingPlayerIds = pieces.filter((p) => p.direction === "OUT").map((p) => p.playerId);
    const incomingPlayerIds = pieces.filter((p) => p.direction === "IN").map((p) => p.playerId);
    return { outgoingPlayerIds, incomingPlayerIds };
  }

  private async logTransferEvent(params: {
    saveId: number;
    offerId: number;
    fromTeamId: number;
    toTeamId: number;
    day: number;
    eventType: string;
    status: string;
    message?: string;
    payload?: unknown;
  }) {
    return prisma.transferTransactionLog.create({
      data: {
        saveId: params.saveId,
        offerId: params.offerId,
        fromTeamId: params.fromTeamId,
        toTeamId: params.toTeamId,
        day: params.day,
        eventType: params.eventType,
        status: params.status,
        message: params.message ?? null,
        payload: (params.payload ?? null) as any,
      },
    });
  }
}

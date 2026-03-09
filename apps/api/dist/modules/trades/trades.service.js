"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradesService = exports.__transferTestUtils = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../common/errors/AppError");
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function hashString(input) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
exports.__transferTestUtils = {
    hashString,
    mulberry32,
};
function parsePosBucket(pos) {
    const p = String(pos ?? "").toUpperCase();
    if (p.includes("C"))
        return "B";
    if (p.includes("PF") || p.includes("SF"))
        return "W";
    return "G";
}
function seasonDayFromSave(save) {
    const payload = (save.data ?? {});
    const current = new Date(`${String(payload.currentDate ?? save.currentDate.toISOString().slice(0, 10))}T00:00:00.000Z`);
    const startYear = Number(String(save.season ?? "2025-26").slice(0, 4)) || current.getUTCFullYear();
    const seasonStart = new Date(Date.UTC(startYear, 9, 1)); // Oct 1
    return Math.max(0, Math.floor((current.getTime() - seasonStart.getTime()) / 86400000));
}
class TradesService {
    async listOffers(saveId) {
        await this.ensureSave(saveId);
        await this.reconcileSaveTransferState(saveId);
        const offers = await prisma_1.default.transferOffer.findMany({
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
                    outgoing: offer.playerPieces.filter((p) => p.direction === "OUT").map((p) => ({ id: p.playerId, name: p.player.name, position: p.player.position, salary: p.player.salary })),
                    incoming: offer.playerPieces.filter((p) => p.direction === "IN").map((p) => ({ id: p.playerId, name: p.player.name, position: p.player.position, salary: p.player.salary })),
                },
            };
        });
    }
    async createOffer(dto) {
        const save = await this.ensureSave(dto.saveId);
        const outgoingPlayerIds = [...new Set((dto.outgoingPlayerIds ?? []).map(Number).filter(Number.isFinite))];
        const incomingPlayerIds = [...new Set((dto.incomingPlayerIds ?? []).map(Number).filter(Number.isFinite))];
        if (!outgoingPlayerIds.length || !incomingPlayerIds.length) {
            throw new AppError_1.BadRequestError("Offer must include at least one outgoing and one incoming player");
        }
        if (!Number.isFinite(dto.fromTeamId) || !Number.isFinite(dto.toTeamId) || dto.fromTeamId === dto.toTeamId) {
            throw new AppError_1.BadRequestError("Invalid from/to team");
        }
        const [fromTeam, toTeam, players, saveState] = await Promise.all([
            prisma_1.default.team.findUnique({ where: { id: dto.fromTeamId } }),
            prisma_1.default.team.findUnique({ where: { id: dto.toTeamId } }),
            prisma_1.default.player.findMany({
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
            prisma_1.default.save.findUnique({ where: { id: dto.saveId }, select: { data: true } }),
        ]);
        if (!fromTeam || !toTeam)
            throw new AppError_1.NotFoundError("Team");
        const overrides = (saveState?.data ?? {})?.transferState?.playerTeamOverrides ?? {};
        const byId = new Map(players.map((p) => [p.id, p]));
        for (const playerId of outgoingPlayerIds) {
            const p = byId.get(playerId);
            if (!p)
                throw new AppError_1.BadRequestError(`Outgoing player ${playerId} not found`);
            const effectiveTeamId = Number(overrides[String(playerId)] ?? p.teamId);
            if (effectiveTeamId !== dto.fromTeamId)
                throw new AppError_1.BadRequestError(`Outgoing player ${p.name} does not belong to ${fromTeam.shortName}`);
        }
        for (const playerId of incomingPlayerIds) {
            const p = byId.get(playerId);
            if (!p)
                throw new AppError_1.BadRequestError(`Incoming player ${playerId} not found`);
            const effectiveTeamId = Number(overrides[String(playerId)] ?? p.teamId);
            if (effectiveTeamId !== dto.toTeamId)
                throw new AppError_1.BadRequestError(`Incoming player ${p.name} does not belong to ${toTeam.shortName}`);
        }
        const duplicatePending = await prisma_1.default.transferOffer.findFirst({
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
            const sameOutgoing = JSON.stringify([...dup.outgoingPlayerIds].sort((a, b) => a - b)) === JSON.stringify([...outgoingPlayerIds].sort((a, b) => a - b));
            const sameIncoming = JSON.stringify([...dup.incomingPlayerIds].sort((a, b) => a - b)) === JSON.stringify([...incomingPlayerIds].sort((a, b) => a - b));
            if (sameOutgoing && sameIncoming) {
                throw new AppError_1.BadRequestError("Duplicate pending offer already exists for the same player package");
            }
        }
        const createdDay = seasonDayFromSave(save);
        const delayMin = Number(process.env.TRANSFER_RESOLVE_MIN_DAYS ?? 1);
        const delayMax = Number(process.env.TRANSFER_RESOLVE_MAX_DAYS ?? 3);
        const delay = clamp(Math.round(delayMin + ((hashString(`${save.id}:${createdDay}:${Date.now()}`) % 1000) / 1000) * (Math.max(delayMin, delayMax) - delayMin)), 1, 7);
        const resolveDay = createdDay + delay;
        const offer = await prisma_1.default.transferOffer.create({
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
    async sendOffer(saveId, offerId) {
        const save = await this.ensureSave(saveId);
        const offer = await prisma_1.default.transferOffer.findFirst({
            where: { id: offerId, saveId },
            include: {
                fromTeam: true,
                toTeam: true,
                playerPieces: true,
            },
        });
        if (!offer)
            throw new AppError_1.NotFoundError("Transfer offer");
        if (offer.status !== "DRAFT")
            throw new AppError_1.BadRequestError("Only draft offers can be sent");
        const currentDay = seasonDayFromSave(save);
        const delay = clamp(1 + (hashString(`${saveId}:${offer.id}:${currentDay}`) % 3), 1, 3);
        const updated = await prisma_1.default.transferOffer.update({
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
    async resolvePendingOffersForDay(saveId, day, date) {
        const pending = await prisma_1.default.transferOffer.findMany({
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
            await prisma_1.default.transferOffer.update({
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
    async respondToPlayerProposal(dto) {
        const save = await this.ensureSave(dto.saveId);
        const proposal = await prisma_1.default.playerContractProposal.findUnique({
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
        if (!proposal || proposal.offer.saveId !== dto.saveId)
            throw new AppError_1.NotFoundError("Player contract proposal");
        if (!["COUNTERED", "OFFERED"].includes(proposal.status))
            throw new AppError_1.BadRequestError("Proposal is not actionable");
        const today = seasonDayFromSave(save);
        const action = dto.action;
        if (action === "DECLINE") {
            await prisma_1.default.$transaction([
                prisma_1.default.playerContractProposal.update({
                    where: { id: proposal.id },
                    data: { status: "REJECTED" },
                }),
                prisma_1.default.transferOffer.update({
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
            : Math.max(500000, Number(dto.proposedSalary ?? proposal.proposedSalary));
        const sendYears = action === "ACCEPT"
            ? proposal.years
            : clamp(Number(dto.years ?? proposal.years), 1, 5);
        const sendRole = String(dto.role ?? proposal.role ?? "rotation");
        const responseDelay = clamp(1 + (hashString(`${dto.saveId}:${proposal.id}:${today}:${action}`) % 2), 1, 2);
        await prisma_1.default.playerContractProposal.update({
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
    async resolvePendingPlayerProposalResponsesForDay(saveId, day, date) {
        const proposals = await prisma_1.default.playerContractProposal.findMany({
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
            await prisma_1.default.playerContractProposal.update({
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
                await prisma_1.default.transferOffer.update({
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
            const latest = await prisma_1.default.transferOffer.findUnique({
                where: { id: proposal.offerId },
                include: { contractProposals: true },
            });
            if (!latest)
                continue;
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
                await prisma_1.default.transferOffer.update({
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
    async evaluateOffer(offer) {
        const players = await prisma_1.default.player.findMany({
            where: { id: { in: [...offer.outgoingPlayerIds, ...offer.incomingPlayerIds] } },
            include: {
                contracts: { include: { contractYears: true } },
            },
        });
        const byId = new Map(players.map((p) => [p.id, p]));
        const toTeamRoster = await prisma_1.default.player.findMany({
            where: { teamId: offer.toTeamId, active: true },
            select: { position: true, overallBase: true, overallCurrent: true },
        });
        const posCounts = { G: 0, W: 0, B: 0 };
        for (const p of toTeamRoster)
            posCounts[parsePosBucket(p.position)] += 1;
        const needScore = (player, direction) => {
            const bucket = parsePosBucket(player.position);
            const count = posCounts[bucket];
            const scarcity = bucket === "B" ? 4 - count : 6 - count;
            const sign = direction === "incoming" ? 1 : -1;
            return sign * clamp(scarcity, -3, 3) * 3;
        };
        const contractSignal = (player) => {
            const years = (player.contracts?.contractYears ?? []).length;
            const expiresSoon = years <= 1 ? -4 : years >= 3 ? 2 : 0;
            const salary = player.salary ?? player.contracts?.currentYearSalary ?? 0;
            const salaryPenalty = salary > 45000000 ? -4 : salary > 30000000 ? -2 : 0;
            return expiresSoon + salaryPenalty;
        };
        const playerValue = (player, direction) => {
            const current = player.overallCurrent ?? player.overallBase ?? player.overall ?? 60;
            const age = player.age ?? 27;
            const ageCurve = age <= 24 ? 4 : age <= 29 ? 2 : age <= 32 ? 0 : -3;
            const potential = ((player.potential ?? current) - current) * 0.25;
            return current + ageCurve + potential + contractSignal(player) + needScore(player, direction);
        };
        const incoming = offer.incomingPlayerIds.map((id) => byId.get(id)).filter(Boolean);
        const outgoing = offer.outgoingPlayerIds.map((id) => byId.get(id)).filter(Boolean);
        const incomingValue = incoming.reduce((s, p) => s + playerValue(p, "incoming"), 0) + (offer.cashIn ?? 0) / 2000000;
        const outgoingValue = outgoing.reduce((s, p) => s + playerValue(p, "outgoing"), 0) + (offer.cashOut ?? 0) / 2000000;
        const diff = incomingValue - outgoingValue; // value for target club (toTeam)
        const salaryIncoming = incoming.reduce((s, p) => s + (p.salary ?? 0), 0) + (offer.cashIn ?? 0);
        const salaryOutgoing = outgoing.reduce((s, p) => s + (p.salary ?? 0), 0) + (offer.cashOut ?? 0);
        const salaryDelta = salaryIncoming - salaryOutgoing;
        const salaryPenalty = salaryDelta > 15000000 ? -8 : salaryDelta > 5000000 ? -3 : 0;
        const save = await prisma_1.default.save.findUnique({ where: { id: offer.saveId }, select: { season: true } });
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
    async createAgentCounterProposals(offerId, saveId, date, day) {
        const offer = await prisma_1.default.transferOffer.findUnique({
            where: { id: offerId },
            include: {
                fromTeam: true,
                toTeam: true,
                playerPieces: true,
            },
        });
        if (!offer)
            return 0;
        const pieceArrays = this.getOfferPlayerIdsFromPieces(offer.playerPieces);
        const incomingPlayers = await prisma_1.default.player.findMany({
            where: { id: { in: pieceArrays.incomingPlayerIds.length ? pieceArrays.incomingPlayerIds : offer.incomingPlayerIds } },
            include: { contracts: { include: { contractYears: true } } },
        });
        if (incomingPlayers.length === 0)
            return 0;
        const created = [];
        for (const player of incomingPlayers) {
            const baseSalary = player.salary ?? player.contracts?.currentYearSalary ?? 1500000;
            const seed = hashString(`${saveId}:${offerId}:${player.id}:${day}:agent`);
            const rng = mulberry32(seed);
            const askMultiplier = 1.03 + rng() * 0.22;
            const proposedSalary = Math.round(baseSalary * askMultiplier);
            const years = clamp(Math.round(2 + rng() * 2), 1, 5);
            const role = (player.overallCurrent ?? player.overallBase ?? player.overall ?? 60) >= 80 ? "starter" : "rotation";
            created.push(prisma_1.default.playerContractProposal.create({
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
        if (created.length > 0)
            await prisma_1.default.$transaction(created);
        await prisma_1.default.transferOffer.update({
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
    async evaluatePlayerContractResponse(proposal, saveId) {
        const baseSalary = proposal.player.salary ?? 1500000;
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
    async ensureSave(saveId) {
        const save = await prisma_1.default.save.findUnique({ where: { id: saveId } });
        if (!save)
            throw new AppError_1.NotFoundError("Save");
        return save;
    }
    async createInboxMessage(params) {
        return prisma_1.default.inboxMessage.create({
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
    formatMoney(value) {
        return `$${(value / 1000000).toFixed(1)}M`;
    }
    async reconcileSaveTransferState(saveId) {
        const [save, completedOffers] = await Promise.all([
            prisma_1.default.save.findUnique({ where: { id: saveId }, select: { data: true, season: true } }),
            prisma_1.default.transferOffer.findMany({
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
        if (!save || completedOffers.length === 0)
            return;
        const data = (save.data ?? {}) || {};
        const current = data.transferState ?? {};
        const currentOverrides = current.playerTeamOverrides ?? {};
        const existingTransactions = Array.isArray(current.transactions) ? current.transactions : [];
        const existingOfferIds = new Set(existingTransactions.map((t) => Number(t?.offerId)).filter(Number.isFinite));
        let changed = false;
        const nextOverrides = { ...currentOverrides };
        const nextTransactions = [...existingTransactions];
        const seasonStartYear = Number(String(save.season ?? "2025-26").slice(0, 4)) || 2025;
        const seasonStart = new Date(Date.UTC(seasonStartYear, 9, 1));
        for (const offer of completedOffers) {
            const shouldBackfill = !existingOfferIds.has(offer.id);
            // Always recompute override end-state from completed offers (id order), so corrupted/missing state self-heals.
            const pieceArrays = this.getOfferPlayerIdsFromPieces(offer.playerPieces ?? []);
            const outgoing = pieceArrays.outgoingPlayerIds.length ? pieceArrays.outgoingPlayerIds : offer.outgoingPlayerIds;
            const incoming = pieceArrays.incomingPlayerIds.length ? pieceArrays.incomingPlayerIds : offer.incomingPlayerIds;
            for (const playerId of outgoing)
                nextOverrides[String(playerId)] = offer.toTeamId;
            for (const playerId of incoming)
                nextOverrides[String(playerId)] = offer.fromTeamId;
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
        if (overridesChanged)
            changed = true;
        if (!changed)
            return;
        data.transferState = {
            playerTeamOverrides: nextOverrides,
            transactions: nextTransactions,
        };
        await prisma_1.default.save.update({
            where: { id: saveId },
            data: { data: data },
        });
    }
    async applyCompletedTransferToSaveState(params) {
        const save = await prisma_1.default.save.findUnique({ where: { id: params.saveId }, select: { data: true, season: true } });
        if (!save)
            return;
        const data = (save.data ?? {});
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
        await prisma_1.default.save.update({
            where: { id: params.saveId },
            data: { data: data },
        });
    }
    getOfferPlayerIdsFromPieces(pieces) {
        const outgoingPlayerIds = pieces.filter((p) => p.direction === "OUT").map((p) => p.playerId);
        const incomingPlayerIds = pieces.filter((p) => p.direction === "IN").map((p) => p.playerId);
        return { outgoingPlayerIds, incomingPlayerIds };
    }
    async logTransferEvent(params) {
        return prisma_1.default.transferTransactionLog.create({
            data: {
                saveId: params.saveId,
                offerId: params.offerId,
                fromTeamId: params.fromTeamId,
                toTeamId: params.toTeamId,
                day: params.day,
                eventType: params.eventType,
                status: params.status,
                message: params.message ?? null,
                payload: (params.payload ?? null),
            },
        });
    }
}
exports.TradesService = TradesService;
//# sourceMappingURL=trades.service.js.map
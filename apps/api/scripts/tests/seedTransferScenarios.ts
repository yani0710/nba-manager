import "dotenv/config";
import prisma from "../../src/config/prisma";
import { TradesService } from "../../src/modules/trades/trades.service";
import { SavesService } from "../../src/modules/saves/saves.service";
import { CapService } from "../../src/modules/trades/cap.service";

function combinations<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [[]];
  if (size > items.length) return [];
  const out: T[][] = [];
  const path: T[] = [];
  const dfs = (start: number) => {
    if (path.length === size) {
      out.push([...path]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      path.push(items[i]);
      dfs(i + 1);
      path.pop();
    }
  };
  dfs(0);
  return out;
}

function salaryValue(p: { salary: number | null }) {
  return Math.max(0, Number(p.salary ?? 0));
}

async function main() {
  const trades = new TradesService();
  const saves = new SavesService();
  const cap = new CapService();

  const save = await prisma.save.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, managedTeamId: true, teamId: true },
  });
  if (!save) throw new Error("No save found. Create a save first.");

  const teamId = save.managedTeamId ?? save.teamId;
  if (!teamId) throw new Error("Save has no managed team.");

  const freeAgentTeam = await prisma.team.findUnique({ where: { shortName: "FA" }, select: { id: true } });
  if (!freeAgentTeam) throw new Error("FA team not found.");

  const freeAgent = await prisma.player.findFirst({
    where: { active: true, teamId: freeAgentTeam.id },
    orderBy: [{ overallCurrent: "desc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  if (!freeAgent) throw new Error("No free agent available.");

  const legalOffer = await trades.submitContractOffer({
    saveId: save.id,
    teamId,
    playerId: freeAgent.id,
    salaryPerYear: 3_500_000,
    years: 2,
    rolePromise: "rotation",
    optionType: null,
    decisionDays: 2,
  });

  let illegalOfferError = "";
  try {
    await trades.submitContractOffer({
      saveId: save.id,
      teamId,
      playerId: freeAgent.id,
      salaryPerYear: 200_000_000,
      years: 5,
      rolePromise: "star",
      optionType: "PLAYER_OPTION",
      decisionDays: 2,
    });
  } catch (err: any) {
    illegalOfferError = err?.message ?? "illegal offer rejected";
  }

  const myRoster = await prisma.player.findMany({
    where: { active: true, teamId },
    orderBy: [{ salary: "asc" }, { overallCurrent: "desc" }, { id: "asc" }],
    take: 20,
    select: { id: true, salary: true },
  });
  const targetTeams = await prisma.team.findMany({
    where: { id: { not: teamId }, shortName: { not: "FA" } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (targetTeams.length === 0) throw new Error("No target team found.");
  if (myRoster.length === 0) throw new Error("Insufficient roster data for trade scenario.");

  const mySummary = await cap.getTeamCapSummary(teamId);
  let targetTeamId = targetTeams[0].id;
  let legalFromTeamId = teamId;
  let theirRoster: Array<{ id: number; salary: number | null }> = [];
  let legalOutgoingIds = [myRoster[0].id];
  let legalIncomingIds = [myRoster[0].id];
  let foundLegal = false;
  const myPool = myRoster.slice(0, 12);
  for (const targetTeam of targetTeams) {
    if (foundLegal) break;
    theirRoster = await prisma.player.findMany({
      where: { active: true, teamId: targetTeam.id },
      orderBy: [{ salary: "asc" }, { overallCurrent: "desc" }, { id: "asc" }],
      take: 20,
      select: { id: true, salary: true },
    });
    if (!theirRoster.length) continue;
    const theirPool = theirRoster.slice(0, 12);
    const theirSummary = await cap.getTeamCapSummary(targetTeam.id);
    const hardCap = Math.min(mySummary.hardCap, theirSummary.hardCap);

    for (const outSize of [1, 2]) {
      if (foundLegal) break;
      const outCombos = combinations(myPool, outSize);
      for (const inSize of [1, 2]) {
        if (foundLegal) break;
        const inCombos = combinations(theirPool, inSize);
        for (const outCombo of outCombos) {
          if (foundLegal) break;
          const outgoingSalary = outCombo.reduce((s, p) => s + salaryValue(p), 0);
          for (const inCombo of inCombos) {
            const incomingSalary = inCombo.reduce((s, p) => s + salaryValue(p), 0);
            const fromProjected = mySummary.payroll - outgoingSalary + incomingSalary;
            const toProjected = theirSummary.payroll - incomingSalary + outgoingSalary;
            if (fromProjected > hardCap || toProjected > hardCap) continue;
            if (mySummary.overCap && incomingSalary > outgoingSalary * 1.25 + 250_000) continue;
            if (theirSummary.overCap && outgoingSalary > incomingSalary * 1.25 + 250_000) continue;
            const check = await cap.validateTradeProposal({
              fromTeamId: teamId,
              toTeamId: targetTeam.id,
              outgoingPlayerIds: outCombo.map((p) => p.id),
              incomingPlayerIds: inCombo.map((p) => p.id),
            });
            if (check.legal) {
              targetTeamId = targetTeam.id;
              legalOutgoingIds = outCombo.map((p) => p.id);
              legalIncomingIds = inCombo.map((p) => p.id);
              foundLegal = true;
              break;
            }
          }
        }
      }
    }
  }

  // Fallback: if managed team has no legal trade in this save state, find any league-legal trade.
  if (!foundLegal) {
    const allTeams = await prisma.team.findMany({
      where: { shortName: { not: "FA" } },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    for (const from of allTeams) {
      if (foundLegal) break;
      const fromSummary = await cap.getTeamCapSummary(from.id);
      const fromRoster = await prisma.player.findMany({
        where: { active: true, teamId: from.id },
        orderBy: [{ salary: "asc" }, { id: "asc" }],
        take: 10,
        select: { id: true, salary: true },
      });
      if (!fromRoster.length) continue;
      for (const to of allTeams) {
        if (foundLegal) break;
        if (to.id === from.id) continue;
        const toSummary = await cap.getTeamCapSummary(to.id);
        const toRoster = await prisma.player.findMany({
          where: { active: true, teamId: to.id },
          orderBy: [{ salary: "asc" }, { id: "asc" }],
          take: 10,
          select: { id: true, salary: true },
        });
        if (!toRoster.length) continue;
        const hardCap = Math.min(fromSummary.hardCap, toSummary.hardCap);
        for (const out of fromRoster) {
          if (foundLegal) break;
          const outSalary = salaryValue(out);
          for (const inn of toRoster) {
            const inSalary = salaryValue(inn);
            const fromProjected = fromSummary.payroll - outSalary + inSalary;
            const toProjected = toSummary.payroll - inSalary + outSalary;
            if (fromProjected > hardCap || toProjected > hardCap) continue;
            if (fromSummary.overCap && inSalary > outSalary * 1.25 + 250_000) continue;
            if (toSummary.overCap && outSalary > inSalary * 1.25 + 250_000) continue;
            const check = await cap.validateTradeProposal({
              fromTeamId: from.id,
              toTeamId: to.id,
              outgoingPlayerIds: [out.id],
              incomingPlayerIds: [inn.id],
            });
            if (!check.legal) continue;
            targetTeamId = to.id;
            legalFromTeamId = from.id;
            legalOutgoingIds = [out.id];
            legalIncomingIds = [inn.id];
            foundLegal = true;
            break;
          }
        }
      }
    }
  }
  if (!foundLegal) {
    throw new Error("Could not find a legal trade scenario in current save data.");
  }

  const legalTrade = await trades.submitTradeProposal({
    saveId: save.id,
    fromTeamId: legalFromTeamId,
    toTeamId: targetTeamId,
    outgoingPlayerIds: legalOutgoingIds,
    incomingPlayerIds: legalIncomingIds,
    responseDays: 2,
  });

  const illegalOutgoing = [myRoster[0].id];
  if (!theirRoster.length) {
    theirRoster = await prisma.player.findMany({
      where: { active: true, teamId: targetTeamId },
      orderBy: [{ salary: "desc" }, { id: "asc" }],
      take: 20,
      select: { id: true, salary: true },
    });
  }
  const illegalIncoming = theirRoster
    .slice()
    .sort((a, b) => (Number(b.salary ?? 0) - Number(a.salary ?? 0)))
    .slice(0, Math.min(3, theirRoster.length))
    .map((p) => p.id);
  const illegalTrade = await trades.submitTradeProposal({
    saveId: save.id,
    fromTeamId: teamId,
    toTeamId: targetTeamId,
    outgoingPlayerIds: illegalOutgoing,
    incomingPlayerIds: illegalIncoming,
    responseDays: 2,
  });

  await saves.advanceSave(save.id);
  await saves.advanceSave(save.id);
  await saves.advanceSave(save.id);

  const [offersAfter, proposalsAfter] = await Promise.all([
    trades.listContractOffers(save.id, teamId),
    trades.listTradeProposals(save.id),
  ]);

  console.log(JSON.stringify({
    saveId: save.id,
    legalOfferId: legalOffer.id,
    illegalOfferError,
    legalTradeId: legalTrade.id,
    illegalTradeId: illegalTrade.id,
    illegalTradeStatus: illegalTrade.status,
    contractOfferStatuses: offersAfter.map((o) => ({ id: o.id, status: o.status, player: o.player?.name })),
    tradeProposalStatuses: proposalsAfter.map((p) => ({ id: p.id, status: p.status, reason: p.decisionReason })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

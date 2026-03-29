import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function salaryScore(salary: number | null | undefined) {
  const m = Number(salary ?? 0) / 1_000_000;
  if (m >= 55) return 92;
  if (m >= 50) return 90;
  if (m >= 45) return 88;
  if (m >= 40) return 86;
  if (m >= 35) return 84;
  if (m >= 30) return 82;
  if (m >= 25) return 80;
  if (m >= 20) return 77;
  if (m >= 15) return 74;
  if (m >= 12) return 72;
  if (m >= 8) return 69;
  return 66;
}

function performanceScore(ptsCareer: number | null | undefined, per: number | null | undefined) {
  const pts = Number(ptsCareer ?? 10);
  const perVal = Number(per ?? 12);
  const score = 60 + (pts - 10) * 1.2 + (perVal - 12) * 1.5;
  return clamp(Math.round(score), 60, 93);
}

function ageAdjust(age: number | null | undefined) {
  const a = Number(age ?? 27);
  if (a >= 37) return -8;
  if (a >= 35) return -6;
  if (a >= 33) return -4;
  if (a >= 31) return -2;
  return 0;
}

async function main() {
  const candidates = await prisma.player.findMany({
    where: {
      active: true,
      team: { shortName: { not: "FA" } },
      OR: [
        { salary: { gte: 15_000_000 }, overallCurrent: { lte: 76 } },
        { ptsCareer: { gte: 18 }, overallCurrent: { lte: 79 } },
        { per: { gte: 18 }, overallCurrent: { lte: 79 } },
      ],
    },
    select: {
      id: true,
      name: true,
      age: true,
      salary: true,
      ptsCareer: true,
      per: true,
      potential: true,
      overall: true,
      overallBase: true,
      overallCurrent: true,
      team: { select: { shortName: true } },
    },
  });

  let updated = 0;
  const updatedIds: number[] = [];
  const sample: Array<{ id: number; name: string; team: string; from: number; to: number }> = [];

  for (const p of candidates) {
    const sScore = salaryScore(p.salary);
    const perfScore = performanceScore(p.ptsCareer, p.per);
    const expected = clamp(Math.round(sScore * 0.55 + perfScore * 0.45 + ageAdjust(p.age)), 62, 95);
    const current = Number(p.overallCurrent ?? p.overall ?? 60);

    // only repair clearly broken ratings
    if (current >= expected - 6) continue;

    const nextCurrent = expected;
    const nextBase = clamp(Math.min(nextCurrent - 4, Number(p.overallBase ?? nextCurrent - 4)), 58, 93);
    const nextPotential = clamp(Math.max(Number(p.potential ?? 70), nextCurrent + 3), 65, 99);

    await prisma.player.update({
      where: { id: p.id },
      data: {
        overallCurrent: nextCurrent,
        overall: nextCurrent,
        overallBase: nextBase,
        potential: nextPotential,
      },
    });
    updated += 1;
    updatedIds.push(p.id);
    if (sample.length < 25) {
      sample.push({
        id: p.id,
        name: p.name,
        team: p.team?.shortName ?? "-",
        from: current,
        to: nextCurrent,
      });
    }
  }

  // Sync save-level overrides so UI shows corrected values immediately.
  if (updatedIds.length > 0) {
    const saves = await prisma.save.findMany({
      select: { id: true, data: true },
    });
    for (const save of saves) {
      const payload = (save.data ?? {}) as {
        playerState?: Record<string, { effectiveOverall?: number; morale?: number; form?: number; fatigue?: number }>;
      };
      if (!payload.playerState) continue;
      let changed = false;
      const nextState = { ...payload.playerState };
      for (const playerId of updatedIds) {
        const key = String(playerId);
        const row = nextState[key];
        if (!row) continue;
        const player = await prisma.player.findUnique({
          where: { id: playerId },
          select: { overallCurrent: true },
        });
        if (!player) continue;
        nextState[key] = {
          ...row,
          effectiveOverall: Number(player.overallCurrent ?? row.effectiveOverall ?? 60),
        };
        changed = true;
      }
      if (changed) {
        await prisma.save.update({
          where: { id: save.id },
          data: {
            data: {
              ...(payload as object),
              playerState: nextState,
            } as any,
          },
        });
      }
    }
  }

  console.log(JSON.stringify({
    candidates: candidates.length,
    updated,
    sample,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const totalPlayers = await prisma.player.count();
  const [
    missingBirthDate,
    missingHeightCm,
    missingWeightKg,
    missingNationality,
    missingAttributesResult,
    lowOverall,
    lowPotential,
    missingNumbers,
    overallStats,
  ] = await Promise.all([
    prisma.player.count({ where: { birthDate: null } }),
    prisma.player.count({ where: { heightCm: null } }),
    prisma.player.count({ where: { weightKg: null } }),
    prisma.player.count({ where: { nationality: null } }),
    prisma.$queryRaw<Array<{ cnt: number }>>`SELECT COUNT(*)::int AS cnt FROM "Player" WHERE "attributes" IS NULL`,
    prisma.player.count({ where: { overall: { lt: 50 } } }),
    prisma.player.count({ where: { potential: { lt: 55 } } }),
    prisma.player.count({ where: { active: true, number: null } }),
    prisma.player.aggregate({
      where: { active: true },
      _min: { overall: true },
      _max: { overall: true },
      _avg: { overall: true },
    }),
  ]);

  const contractsWithoutTeam = await prisma.contract.count({
    where: { teamId: null },
  });
  const missingAttributes = missingAttributesResult?.[0]?.cnt ?? 0;

  const savesWithoutPlayerState = await prisma.save.findMany({
    select: { id: true, data: true },
  });
  const missingPlayerState = savesWithoutPlayerState.filter((save) => {
    const data = save.data as Record<string, unknown> | null;
    return !data || typeof data !== "object" || !("playerState" in data);
  }).length;

  const forms: number[] = [];
  for (const save of savesWithoutPlayerState) {
    const data = (save.data ?? {}) as { playerState?: Record<string, { form?: number }> };
    for (const state of Object.values(data.playerState ?? {})) {
      if (typeof state?.form === "number") forms.push(state.form);
    }
  }
  const formMin = forms.length ? Math.min(...forms) : null;
  const formMax = forms.length ? Math.max(...forms) : null;
  const formAvg = forms.length ? Number((forms.reduce((s, v) => s + v, 0) / forms.length).toFixed(2)) : null;

  console.log("=== DATA QUALITY REPORT ===");
  console.log(`players total: ${totalPlayers}`);
  console.log(`missing birthDate: ${missingBirthDate}`);
  console.log(`missing heightCm: ${missingHeightCm}`);
  console.log(`missing weightKg: ${missingWeightKg}`);
  console.log(`missing nationality: ${missingNationality}`);
  console.log(`missing attributes: ${missingAttributes}`);
  console.log(`overall < 50: ${lowOverall}`);
  console.log(`potential < 55: ${lowPotential}`);
  console.log(`missing jersey numbers (active): ${missingNumbers}`);
  console.log(`overall distribution min/max/avg: ${overallStats._min.overall ?? "-"} / ${overallStats._max.overall ?? "-"} / ${(overallStats._avg.overall ?? 0).toFixed(2)}`);
  console.log(`form distribution min/max/avg: ${formMin ?? "-"} / ${formMax ?? "-"} / ${formAvg ?? "-"}`);
  console.log(`contracts missing teamId: ${contractsWithoutTeam}`);
  console.log(`saves missing playerState: ${missingPlayerState}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toCm(height: number | null): number | null {
  if (height === null) return null;
  return height <= 100 ? Math.round(height * 2.54) : height;
}

function toKg(weight: number | null): number | null {
  if (weight === null) return null;
  return weight > 140 ? Math.round(weight * 0.45359237) : weight;
}

async function main() {
  const players = await prisma.player.findMany({
    select: { id: true, heightCm: true, weightKg: true },
  });

  let updated = 0;

  for (const p of players) {
    const normalizedHeight = toCm(p.heightCm);
    const normalizedWeight = toKg(p.weightKg);

    if (normalizedHeight !== p.heightCm || normalizedWeight !== p.weightKg) {
      await prisma.player.update({
        where: { id: p.id },
        data: {
          heightCm: normalizedHeight ?? undefined,
          weightKg: normalizedWeight ?? undefined,
        },
      });
      updated += 1;
    }
  }

  console.log(`Normalized players: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

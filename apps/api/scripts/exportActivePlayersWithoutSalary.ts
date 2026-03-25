import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../src/config/prisma";

async function main() {
  const players = await prisma.player.findMany({
    where: { active: true, salary: null },
    select: {
      id: true,
      name: true,
      team: { select: { shortName: true, name: true } },
    },
    orderBy: [{ teamId: "asc" }, { name: "asc" }],
  });

  const lines: string[] = [];
  lines.push(`Active players without salary: ${players.length}`);
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("id | player | teamCode | team");

  for (const player of players) {
    lines.push(
      `${player.id} | ${player.name} | ${player.team.shortName} | ${player.team.name}`
    );
  }

  const outputPath = path.join(__dirname, "..", "data", "active_players_without_salary.txt");
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Exported ${players.length} players to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

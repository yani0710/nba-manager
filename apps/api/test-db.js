require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const teamsCount = await prisma.team.count();
  console.log("Teams in DB:", teamsCount);
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());

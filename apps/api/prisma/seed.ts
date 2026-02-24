import fs from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TeamSeed = {
  nbaTeamId: number;
  name: string;
  shortName: string;
  city: string;
  conference: "East" | "West";
  division: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoKey?: string;
  logoPath: string;
};

type PlayerSeed = {
  nbaPlayerId?: number;
  firstName: string;
  lastName: string;
  number?: number | null;
  position: string;
  birthDate?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  nationality?: string | null;
  overall?: number;
  potential?: number;
  handedness?: string | null;
  primaryPosition?: string | null;
  secondaryPosition?: string | null;
  attributes?: Record<string, number> | null;
  teamShortName: string;
  isActive?: boolean;
};

type ContractSeed = {
  playerName: string;
  contractType?: string;
  startYear?: number;
  endYear?: number;
  totalValue?: number;
  guaranteedValue?: number;
  annualValue?: number;
  currentYearSalary?: number;
  years?: Array<{
    season: string;
    salary: number;
    guaranteed?: boolean;
  }>;
};

const DATA_DIR = path.resolve(__dirname, "data");
const NBA_DATA_SEASON = process.env.NBA_DATA_SEASON ?? "2025-26";
const PLAYERS_FILE = path.join(DATA_DIR, `players.nba.${NBA_DATA_SEASON}.json`);
const CONTRACTS_FILE = path.join(DATA_DIR, `contracts.nba.${NBA_DATA_SEASON}.json`);

const NBA_TEAMS: TeamSeed[] = [
  { nbaTeamId: 1610612737, name: "Atlanta Hawks", shortName: "ATL", city: "Atlanta", conference: "East", division: "Southeast", primaryColor: "#E03A3E", secondaryColor: "#C1D32F", logoKey: "atl", logoPath: "/images/teams/atl.png" },
  { nbaTeamId: 1610612738, name: "Boston Celtics", shortName: "BOS", city: "Boston", conference: "East", division: "Atlantic", primaryColor: "#007A33", secondaryColor: "#BA9653", logoKey: "bos", logoPath: "/images/teams/bos.png" },
  { nbaTeamId: 1610612751, name: "Brooklyn Nets", shortName: "BKN", city: "Brooklyn", conference: "East", division: "Atlantic", primaryColor: "#000000", secondaryColor: "#FFFFFF", logoKey: "bkn", logoPath: "/images/teams/bkn.png" },
  { nbaTeamId: 1610612766, name: "Charlotte Hornets", shortName: "CHA", city: "Charlotte", conference: "East", division: "Southeast", primaryColor: "#1D1160", secondaryColor: "#00788C", logoKey: "cha", logoPath: "/images/teams/cha.png" },
  { nbaTeamId: 1610612741, name: "Chicago Bulls", shortName: "CHI", city: "Chicago", conference: "East", division: "Central", primaryColor: "#CE1141", secondaryColor: "#000000", logoKey: "chi", logoPath: "/images/teams/chi.png" },
  { nbaTeamId: 1610612739, name: "Cleveland Cavaliers", shortName: "CLE", city: "Cleveland", conference: "East", division: "Central", primaryColor: "#6F263D", secondaryColor: "#FFB81C", logoKey: "cle", logoPath: "/images/teams/cle.png" },
  { nbaTeamId: 1610612742, name: "Dallas Mavericks", shortName: "DAL", city: "Dallas", conference: "West", division: "Southwest", primaryColor: "#00538C", secondaryColor: "#B8C4CA", logoKey: "dal", logoPath: "/images/teams/dal.png" },
  { nbaTeamId: 1610612743, name: "Denver Nuggets", shortName: "DEN", city: "Denver", conference: "West", division: "Northwest", primaryColor: "#0E2240", secondaryColor: "#FEC524", logoKey: "den", logoPath: "/images/teams/den.png" },
  { nbaTeamId: 1610612765, name: "Detroit Pistons", shortName: "DET", city: "Detroit", conference: "East", division: "Central", primaryColor: "#C8102E", secondaryColor: "#1D42BA", logoKey: "det", logoPath: "/images/teams/det.png" },
  { nbaTeamId: 1610612744, name: "Golden State Warriors", shortName: "GSW", city: "San Francisco", conference: "West", division: "Pacific", primaryColor: "#1D428A", secondaryColor: "#FFC72C", logoKey: "gsw", logoPath: "/images/teams/gsw.png" },
  { nbaTeamId: 1610612745, name: "Houston Rockets", shortName: "HOU", city: "Houston", conference: "West", division: "Southwest", logoPath: "/images/teams/hou.png" },
  { nbaTeamId: 1610612754, name: "Indiana Pacers", shortName: "IND", city: "Indianapolis", conference: "East", division: "Central", logoPath: "/images/teams/ind.png" },
  { nbaTeamId: 1610612746, name: "LA Clippers", shortName: "LAC", city: "Los Angeles", conference: "West", division: "Pacific", logoPath: "/images/teams/lac.png" },
  { nbaTeamId: 1610612747, name: "Los Angeles Lakers", shortName: "LAL", city: "Los Angeles", conference: "West", division: "Pacific", logoPath: "/images/teams/lal.png" },
  { nbaTeamId: 1610612763, name: "Memphis Grizzlies", shortName: "MEM", city: "Memphis", conference: "West", division: "Southwest", logoPath: "/images/teams/mem.png" },
  { nbaTeamId: 1610612748, name: "Miami Heat", shortName: "MIA", city: "Miami", conference: "East", division: "Southeast", logoPath: "/images/teams/mia.png" },
  { nbaTeamId: 1610612749, name: "Milwaukee Bucks", shortName: "MIL", city: "Milwaukee", conference: "East", division: "Central", logoPath: "/images/teams/mil.png" },
  { nbaTeamId: 1610612750, name: "Minnesota Timberwolves", shortName: "MIN", city: "Minneapolis", conference: "West", division: "Northwest", logoPath: "/images/teams/min.png" },
  { nbaTeamId: 1610612740, name: "New Orleans Pelicans", shortName: "NOP", city: "New Orleans", conference: "West", division: "Southwest", logoPath: "/images/teams/nop.png" },
  { nbaTeamId: 1610612752, name: "New York Knicks", shortName: "NYK", city: "New York", conference: "East", division: "Atlantic", logoPath: "/images/teams/nyk.png" },
  { nbaTeamId: 1610612760, name: "Oklahoma City Thunder", shortName: "OKC", city: "Oklahoma City", conference: "West", division: "Northwest", logoPath: "/images/teams/okc.png" },
  { nbaTeamId: 1610612753, name: "Orlando Magic", shortName: "ORL", city: "Orlando", conference: "East", division: "Southeast", logoPath: "/images/teams/orl.png" },
  { nbaTeamId: 1610612755, name: "Philadelphia 76ers", shortName: "PHI", city: "Philadelphia", conference: "East", division: "Atlantic", logoPath: "/images/teams/phi.png" },
  { nbaTeamId: 1610612756, name: "Phoenix Suns", shortName: "PHX", city: "Phoenix", conference: "West", division: "Pacific", logoPath: "/images/teams/phx.png" },
  { nbaTeamId: 1610612757, name: "Portland Trail Blazers", shortName: "POR", city: "Portland", conference: "West", division: "Northwest", logoPath: "/images/teams/por.png" },
  { nbaTeamId: 1610612758, name: "Sacramento Kings", shortName: "SAC", city: "Sacramento", conference: "West", division: "Pacific", logoPath: "/images/teams/sac.png" },
  { nbaTeamId: 1610612759, name: "San Antonio Spurs", shortName: "SAS", city: "San Antonio", conference: "West", division: "Southwest", logoPath: "/images/teams/sas.png" },
  { nbaTeamId: 1610612761, name: "Toronto Raptors", shortName: "TOR", city: "Toronto", conference: "East", division: "Atlantic", logoPath: "/images/teams/tor.png" },
  { nbaTeamId: 1610612762, name: "Utah Jazz", shortName: "UTA", city: "Salt Lake City", conference: "West", division: "Northwest", logoPath: "/images/teams/uta.png" },
  { nbaTeamId: 1610612764, name: "Washington Wizards", shortName: "WAS", city: "Washington", conference: "East", division: "Southeast", primaryColor: "#002B5C", secondaryColor: "#E31837", logoKey: "was", logoPath: "/images/teams/was.png" },
];

function readJsonIfExists<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T[];
}

async function main() {
  console.log("Seeding NBA baseline...");

  const playersSeed = readJsonIfExists<PlayerSeed>(PLAYERS_FILE);
  const contractsSeed = readJsonIfExists<ContractSeed>(CONTRACTS_FILE);

  await prisma.gameStat.deleteMany();
  await prisma.game.deleteMany();
  await prisma.inboxMessage.deleteMany();
  await prisma.contractYear.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.player.deleteMany();
  await prisma.save.deleteMany();
  await prisma.coachProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  await prisma.team.createMany({
    data: NBA_TEAMS,
    skipDuplicates: true,
  });

  const teams = await prisma.team.findMany();
  const teamByShortName = new Map(teams.map((team) => [team.shortName, team]));
  const usedNumbersByTeam = new Map<number, Set<number>>();

  if (playersSeed.length === 0) {
    console.warn(`No players file found at ${PLAYERS_FILE}. Teams were seeded only.`);
  } else {
    for (const player of playersSeed) {
      const team = teamByShortName.get(player.teamShortName);
      if (!team) {
        continue;
      }

      let normalizedNumber = player.number ?? null;
      if (normalizedNumber !== null) {
        const teamNumbers = usedNumbersByTeam.get(team.id) ?? new Set<number>();
        if (teamNumbers.has(normalizedNumber)) {
          normalizedNumber = null;
        } else {
          teamNumbers.add(normalizedNumber);
          usedNumbersByTeam.set(team.id, teamNumbers);
        }
      }

      await prisma.player.create({
        data: {
          nbaPlayerId: player.nbaPlayerId,
          firstName: player.firstName,
          lastName: player.lastName,
          name: `${player.firstName} ${player.lastName}`,
          number: normalizedNumber,
          position: player.position,
          birthDate: player.birthDate ? new Date(player.birthDate) : null,
          heightCm: player.heightCm ?? null,
          weightKg: player.weightKg ?? null,
          nationality: player.nationality ?? null,
          overall: player.overall ?? 60,
          potential: player.potential ?? 75,
          handedness: player.handedness ?? null,
          primaryPosition: player.primaryPosition ?? player.position ?? null,
          secondaryPosition: player.secondaryPosition ?? null,
          attributes: player.attributes ?? Prisma.JsonNull,
          teamId: team.id,
          active: player.isActive ?? true,
          isActive: player.isActive ?? true,
        },
      });
    }

    if (contractsSeed.length > 0) {
      const players = await prisma.player.findMany();
      const playerByName = new Map(players.map((player) => [player.name.toLowerCase(), player]));

      for (const contract of contractsSeed) {
        const player = playerByName.get(contract.playerName.toLowerCase());
        if (!player) {
          continue;
        }

        const createdContract = await prisma.contract.create({
          data: {
            playerId: player.id,
            teamId: player.teamId,
            salary: contract.currentYearSalary ?? contract.annualValue ?? null,
            startYear: contract.startYear ?? null,
            endYear: contract.endYear ?? null,
            totalValue: contract.totalValue ? BigInt(contract.totalValue) : null,
            guaranteedValue: contract.guaranteedValue ? BigInt(contract.guaranteedValue) : null,
            averageAnnualValue: contract.annualValue ?? null,
            currentYearSalary: contract.currentYearSalary ?? null,
            contractType: contract.contractType ?? null,
          },
        });

        if (contract.years?.length) {
          await prisma.contractYear.createMany({
            data: contract.years.map((year) => ({
              contractId: createdContract.id,
              season: year.season,
              salary: year.salary,
              guaranteed: year.guaranteed ?? true,
            })),
          });
        }

        if (contract.currentYearSalary) {
          await prisma.player.update({
            where: { id: player.id },
            data: { salary: contract.currentYearSalary },
          });
        }
      }
    }
  }

  const seededUser = await prisma.user.create({
    data: {
      username: "local_manager",
    },
  });

  const seededCoach = await prisma.coachProfile.create({
    data: {
      userId: seededUser.id,
      displayName: "Local Manager",
      avatarId: "spoelstra",
      reputation: 55,
      preferredStyle: "Balanced",
    },
  });

  const defaultTeam = await prisma.team.findUnique({
    where: { shortName: "LAL" },
  });
  const defaultTeamPlayers = defaultTeam
    ? await prisma.player.findMany({
        where: { teamId: defaultTeam.id },
        select: { id: true },
        take: 15,
      })
    : [];
  const seededPlayerState = defaultTeamPlayers.reduce<Record<string, { fatigue: number; morale: number; form: number }>>((acc, player) => {
    acc[String(player.id)] = {
      fatigue: 10,
      morale: 65,
      form: 60,
    };
    return acc;
  }, {});

  const seededSave = await prisma.save.create({
    data: {
      name: "NBA 2025-26",
      description: "Real NBA baseline save",
      userId: seededUser.id,
      coachProfileId: seededCoach.id,
      teamId: defaultTeam?.id ?? null,
      season: "2025-26",
      currentDate: new Date("2025-10-01T00:00:00.000Z"),
      managedTeamId: defaultTeam?.id ?? null,
      coachName: "Local Manager",
      coachAvatarId: seededCoach.avatarId,
      version: 1,
      data: {
        season: "2025-26",
        week: 1,
        status: "active",
        currentDate: "2025-10-01",
        inboxUnread: 3,
        manager: {
          name: "Local Manager",
          username: seededUser.username,
          coachAvatar: seededCoach.avatarId,
        },
        career: {
          teamShortName: defaultTeam?.shortName ?? null,
          unemployed: !defaultTeam,
        },
        injuries: [],
        training: {
          rating: 74,
          trend: "steady",
        },
        playerState: seededPlayerState,
      },
    },
  });

  await prisma.inboxMessage.createMany({
    data: [
      {
        saveId: seededSave.id,
        date: new Date("2025-10-01T00:00:00.000Z"),
        type: "board",
        title: "Welcome to the franchise",
        body: "Ownership expects a playoff push this season.",
        fromName: "Board",
        isRead: false,
      },
      {
        saveId: seededSave.id,
        date: new Date("2025-10-01T00:00:00.000Z"),
        type: "scouting",
        title: "Scouting report updated",
        body: "Three perimeter defenders were highlighted this week.",
        fromName: "Head Scout",
        isRead: false,
      },
      {
        saveId: seededSave.id,
        date: new Date("2025-10-01T00:00:00.000Z"),
        type: "training",
        title: "Training focus ready",
        body: "Player development plan has been prepared by staff.",
        fromName: "Coaching Staff",
        isRead: false,
      },
    ],
  });

  const totalPlayers = await prisma.player.count();
  console.log(`Seed complete: ${NBA_TEAMS.length} teams, ${totalPlayers} players.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

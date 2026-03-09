import { buildTeamRoster } from "../../src/data/loadSalariesRoster";
import { enrichPlayersFromSalariesRoster } from "../../src/data/enrichPlayers";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const base = buildTeamRoster();
  const enriched = await enrichPlayersFromSalariesRoster();

  assert(base.players.length > 0, "No salary-roster players loaded from nba_salaries_clean.csv");
  assert(base.filePath.toLowerCase().includes("nba_salaries_clean.csv"), "Roster source file is not nba_salaries_clean.csv");
  assert(enriched.health.totalPlayersFromSalaries === base.players.length, "Enriched roster count mismatch vs salary roster count");

  for (const [teamCode, players] of enriched.byTeam.entries()) {
    for (const player of players) {
      assert(player.rosterSource === "nba_salaries_clean.csv", `Roster source mismatch for ${player.name}`);
      assert(player.rosterTeamCode === teamCode, `Roster team mismatch for ${player.name}: expected ${teamCode}, got ${player.rosterTeamCode}`);
    }
  }

  console.log("[test:roster-source-guard] PASS");
  console.log({
    sourceFile: enriched.health.sourceFile,
    totalPlayersFromSalaries: enriched.health.totalPlayersFromSalaries,
    matchedInDb: enriched.health.matchedInDb,
    missingInDb: enriched.health.missingInDb,
  });
}

main().catch((err) => {
  console.error("[test:roster-source-guard] FAIL", err);
  process.exit(1);
});


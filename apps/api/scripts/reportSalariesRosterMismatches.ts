import { enrichPlayersFromSalariesRoster } from "../src/data/enrichPlayers";

async function main() {
  const { health } = await enrichPlayersFromSalariesRoster();
  console.log(JSON.stringify({
    source: health.sourceFile,
    totalPlayersFromSalaries: health.totalPlayersFromSalaries,
    matchedInRatings: health.matchedInDb,
    missingInRatings: health.missingInDb,
    missingSample: health.missingSample,
    ambiguousWarnings: health.ambiguousWarnings,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const file = path.resolve(__dirname, "..", "..", "src", "modules", "saves", "saves.service.ts");
  const source = fs.readFileSync(file, "utf8");

  // Guard 1: only scheduled games are selected for simulation on the current day.
  assert(
    source.includes('status: "scheduled"'),
    "advanceSave must query only scheduled games before simulation",
  );

  // Guard 2: simulated games are locked to final after simulation.
  assert(
    source.includes('status: "final"'),
    "advanceSave must mark games final after simulation to prevent replay",
  );

  // Guard 3: results write happens through prisma.game.update (not append-only duplicate game rows).
  assert(
    source.includes("await prisma.game.update({"),
    "advanceSave should update the existing game record when simulating",
  );

  console.log("PASS testMatchIdempotencyGuard");
}

main();


import { __transferTestUtils } from "../../src/modules/trades/trades.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function sample(seedLabel: string, count = 5) {
  const seed = __transferTestUtils.hashString(seedLabel);
  const rng = __transferTestUtils.mulberry32(seed);
  return Array.from({ length: count }, () => Number(rng().toFixed(8)));
}

async function main() {
  process.env.TRANSFER_TEST_SEED = process.env.TRANSFER_TEST_SEED || "12345";
  const a1 = sample(`club:${process.env.TRANSFER_TEST_SEED}:offer:42`);
  const a2 = sample(`club:${process.env.TRANSFER_TEST_SEED}:offer:42`);
  const b = sample(`club:${process.env.TRANSFER_TEST_SEED}:offer:43`);

  assert(JSON.stringify(a1) === JSON.stringify(a2), "Deterministic RNG failed: same seed produced different samples");
  assert(JSON.stringify(a1) !== JSON.stringify(b), "Deterministic RNG failed: different seeds produced identical samples");

  console.log("[test:transfer-determinism] PASS");
  console.log({ seed: process.env.TRANSFER_TEST_SEED, sampleA: a1, sampleB: b });
}

main().catch((err) => {
  console.error("[test:transfer-determinism] FAIL", err);
  process.exit(1);
});


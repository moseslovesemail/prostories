import { discoverCandidates } from "./discover.js";
import { sendCandidate } from "./wordpress.js";

async function main() {
  const result = await discoverCandidates();

  console.log(
    `PSA run: ${result.discovered} discovered, ${result.unique} unique, ${result.selected} selected`
  );

  for (const candidate of result.candidates) {
    await sendCandidate(candidate);
  }

  if (result.errors.length) {
    console.log("Source errors:");
    for (const error of result.errors) {
      console.log(`- ${error.source}: ${error.error}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import * as fs from "fs";
import * as path from "path";

async function main() {
  // Read the compiled artifact
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/ReplateQuest.sol/ReplateQuest.json"
  );

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create the contract config
  const contractConfig = {
    abi: artifact.abi,
  };

  // Ensure lib directory exists
  const libDir = path.join(__dirname, "../src/lib");
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  // Write TypeScript config file
  const outputPath = path.join(libDir, "contract.ts");
  const fileContent = `// Auto-generated from ReplateQuest.sol
// Run: npx hardhat run scripts/export-abi.cts to regenerate

export { CONTRACT_ADDRESS } from "./network.js";

export const REPLATE_QUEST_ABI = ${JSON.stringify(contractConfig.abi, null, 2)} as const;

// Contract constants / initial values
export const CONTRACT_CONSTANTS = {
  INITIAL_FEE: 5e5, // Initial fee in V3: 0.50 USDC (6 decimals), dynamic state variable
  DAILY_FRUIT_VEG_PER_PERSON: 300, // grams
  MIN_HEALTHY_SCORE: 60,
  BASE_POINTS: 50,
  STREAK_BONUS: 25,
  CHECKIN_POINTS: 10,
} as const;
`;

  fs.writeFileSync(outputPath, fileContent);
  console.log("✅ ABI exported to src/lib/contract.ts");
  console.log("   Contract address source: src/lib/network.js (env + fallback)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

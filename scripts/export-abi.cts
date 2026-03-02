import * as fs from "fs";
import * as path from "path";

async function main() {
  // Read the compiled artifact
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/ReplateQuest.sol/ReplateQuest.json"
  );

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create the frontend contract config
  const contractConfig = {
    address: process.env.CONTRACT_ADDRESS || "",
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
// Run: npm run export-abi to regenerate

export const CONTRACT_ADDRESS = "${contractConfig.address || "0x0000000000000000000000000000000000000000"}" as const;

export const REPLATE_QUEST_ABI = ${JSON.stringify(contractConfig.abi, null, 2)} as const;

// Contract constants
export const CONTRACT_CONSTANTS = {
  FEE: 1e6, // 1 USDC (6 decimals)
  DAILY_FRUIT_VEG_PER_PERSON: 300, // grams
  MIN_HEALTHY_SCORE: 60,
  BASE_POINTS: 50,
  STREAK_BONUS: 25,
  CHECKIN_POINTS: 10,
} as const;
`;

  fs.writeFileSync(outputPath, fileContent);
  console.log("✅ ABI exported to src/lib/contract.ts");
  console.log(`   Contract address: ${contractConfig.address || "NOT SET (set CONTRACT_ADDRESS in .env)"}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

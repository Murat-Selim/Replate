const fs = require("fs");
const path = require("path");

const artifactPath = path.join(
  __dirname,
  "../artifacts/contracts/ReplateQuest.sol/ReplateQuest.json"
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const outputs = [
  { path: path.join(__dirname, "../src/lib/contract.ts"), networkImport: "./network.js" },
  { path: path.join(__dirname, "../../frontend-baseapp/src/lib/contract.ts"), networkImport: "@/lib/network" },
  { path: path.join(__dirname, "../../frontend-farcaster/src/lib/contract.ts"), networkImport: "@/lib/network" },
];

const fileContent = (networkImport) => `// Auto-generated from ReplateQuest.sol
// Run: npm run export-abi from backend to regenerate

export { CONTRACT_ADDRESS, DEPLOYMENT_ABI_VERSION } from "${networkImport}";

export const REPLATE_QUEST_ABI = ${JSON.stringify(artifact.abi, null, 2)} as const;

// Contract constants / initial values
export const CONTRACT_CONSTANTS = {
  INITIAL_FEE: 5e5, // Legacy FEE storage slot retained for UUPS compatibility; receipt uploads are free
  DAILY_FRUIT_VEG_PER_PERSON: 300, // grams
  MIN_HEALTHY_SCORE: 60,
  BASE_POINTS: 50,
  STREAK_BONUS: 25,
  CHECKIN_POINTS: 10,
} as const;
`;

for (const output of outputs) {
  fs.writeFileSync(output.path, fileContent(output.networkImport));
  console.log(`ABI exported to ${path.relative(process.cwd(), output.path)}`);
}
console.log("Contract address/version source: deployment.json");

// ReplateQuest Contract ABI for frontend
// Update CONTRACT_ADDRESS after deployment

export const CONTRACT_ADDRESS = "0xb9b7BD63E098ABd55605312933899fC4f3EF59F8" as const;

// Contract constants
export const CONTRACT_CONSTANTS = {
  FEE: 1e6, // 1 USDC (6 decimals)
  DAILY_FRUIT_VEG_PER_PERSON: 300, // grams
  MIN_HEALTHY_SCORE: 60,
  BASE_POINTS: 50,
  STREAK_BONUS: 25,
  CHECKIN_POINTS: 10,
} as const;

// Phase enum
export const Phase = {
  FREE: 0,
  PAID: 1,
} as const;

// Artifact yoksa build patlamasın diye try/catch ile import
let ReplateQuestArtifact: { abi: any[] } = { abi: [] };

try {
  ReplateQuestArtifact = require("../../artifacts/contracts/ReplateQuest.sol/ReplateQuest.json");
} catch {
  console.warn("Contract artifact not found. Run `npm run compile`.");
}

export const REPLATE_QUEST_ABI = ReplateQuestArtifact.abi;

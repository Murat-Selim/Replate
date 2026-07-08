import { getLeaderboard } from "./server/services/contract.js";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  console.log("Starting leaderboard query...");
  try {
    const entries = await getLeaderboard();
    console.log("Leaderboard entries:", entries);
  } catch (error) {
    console.error("Error during leaderboard query:", error);
  }
}

run();

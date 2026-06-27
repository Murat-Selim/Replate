import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent file to store known user addresses
const USERS_FILE = path.resolve(__dirname, "../../.known-users.json");

let knownUsers: Set<string> = new Set();

/**
 * Load known users from disk on startup
 */
export function loadKnownUsers(): void {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
      if (Array.isArray(data)) {
        knownUsers = new Set(data.map((a: string) => a.toLowerCase()));
        console.log(`📋 Loaded ${knownUsers.size} known users from disk`);
      }
    }
  } catch (e) {
    console.warn("⚠️ Failed to load known users file:", e);
  }
}

/**
 * Save known users to disk
 */
function saveKnownUsers(): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(knownUsers), null, 2));
  } catch (e) {
    console.warn("⚠️ Failed to save known users file:", e);
  }
}

/**
 * Register a user address as known (called after check-in or receipt submission)
 */
export function trackUser(address: string): void {
  const normalized = address.toLowerCase();
  if (!knownUsers.has(normalized)) {
    knownUsers.add(normalized);
    saveKnownUsers();
    console.log(`👤 New user tracked: ${normalized} (total: ${knownUsers.size})`);
  }
}

/**
 * Get all known user addresses
 */
export function getKnownUsers(): string[] {
  return Array.from(knownUsers);
}

import { Pool } from "pg";
import { runtimeConfig } from "./config.js";

let pool: Pool | undefined;

export type DatabaseStatus = "ok" | "not_configured" | "error";

export function getDatabasePool(): Pool {
  if (!runtimeConfig.databaseUrl) throw new Error("DATABASE_URL is required");
  return pool ??= new Pool({
    connectionString: runtimeConfig.databaseUrl,
    ssl: runtimeConfig.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export async function getDatabaseStatus(): Promise<{ status: DatabaseStatus }> {
  if (!runtimeConfig.databaseUrl) return { status: "not_configured" };
  try {
    await getDatabasePool().query("SELECT 1");
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
}

export function assertDatabaseConfigured(): void {
  if (!runtimeConfig.databaseUrl) throw new Error("DATABASE_URL is required for verified data persistence");
}

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config();
dotenv.config({ path: ".env.local" });

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: (process.env.DATABASE_SSL || "").trim().toLowerCase() === "require"
    ? { rejectUnauthorized: false }
    : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, "../db/migrations");
    const files = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((file) => /^\d+.*\.sql$/.test(file)).sort()
      : [];

    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [file]);
      if (applied.rowCount) continue;

      await client.query("BEGIN");
      try {
        await client.query(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log(`Database ready (${files.length} migration file${files.length === 1 ? "" : "s"})`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

loadEnv(envPath);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL missing from .env");
  process.exit(1);
}

const pg = require(path.join(rootDir, "lib/db/node_modules/pg"));
const poolOptions = { connectionString: databaseUrl.replace("?sslmode=require", "").replace("&sslmode=require", "") };
if (databaseUrl.includes("sslmode=require")) {
  poolOptions.ssl = { rejectUnauthorized: false };
}
const pool = new pg.Pool(poolOptions);

async function run() {
  try {
    console.log("Connecting to the database...");
    const result = await pool.query('DELETE FROM user_profiles');
    console.log(`Successfully deleted ${result.rowCount} user(s).`);
  } catch (err) {
    console.error("Failed to delete users:", err);
  } finally {
    await pool.end();
  }
}

run();

import { existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

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
  console.error("DATABASE_URL is missing from .env");
  process.exit(1);
}

if (databaseUrl.startsWith("pglite:")) {
  const dataDir = path.resolve(
    rootDir,
    databaseUrl.replace(/^pglite:\/\//, ""),
  );
  mkdirSync(dataDir, { recursive: true });
  console.log(`Using embedded PGlite database at ${dataDir}`);
} else {
  const pg = require(path.join(rootDir, "lib/db/node_modules/pg"));
  console.log("Checking PostgreSQL connection...");
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL is reachable.");
  } catch (err) {
    console.error("\nCould not connect to PostgreSQL.");
    console.error(String(err));
    console.error(`
Setup options:

1) Embedded PGlite (no install required):
   DATABASE_URL=pglite://.local/repograph-pg

2) Docker:
   docker compose up -d
   DATABASE_URL=postgresql://postgres:repograph@localhost:5432/repograph

3) Local PostgreSQL install with matching DATABASE_URL in .env

Then rerun: pnpm run setup:db
`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

console.log("Pushing Drizzle schema...");
const push = spawnSync("pnpm", ["--filter", "@workspace/db", "run", "push"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(push.status ?? 1);

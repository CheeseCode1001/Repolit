import path from "path";
import { fileURLToPath } from "node:url";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function resolvePgliteDir(rawPath: string): string {
  const dataDir = rawPath.replace(/^pglite:\/\//, "");
  return path.isAbsolute(dataDir) ? dataDir : path.resolve(repoRoot, dataDir);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isPglite = databaseUrl.startsWith("pglite:");

export const pool = isPglite
  ? null
  : new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    });

export const pgliteClient = isPglite
  ? new PGlite(resolvePgliteDir(databaseUrl))
  : null;

export const db = isPglite
  ? drizzlePglite(pgliteClient!, { schema })
  : drizzlePg(pool!, { schema });

export * from "./schema";

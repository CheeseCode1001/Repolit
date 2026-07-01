import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const databaseUrl = process.env.DATABASE_URL;
const isPglite = databaseUrl.startsWith("pglite:");

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  ...(isPglite
    ? {
        driver: "pglite",
        dbCredentials: {
          url: path.resolve(
            repoRoot,
            databaseUrl.replace(/^pglite:\/\//, ""),
          ),
        },
      }
    : {
        dbCredentials: {
          url: databaseUrl.replace("?sslmode=require", "").replace("&sslmode=require", ""),
          ...(databaseUrl.includes("sslmode=require") ? { ssl: { rejectUnauthorized: false } } : {})
        },
      }),
});

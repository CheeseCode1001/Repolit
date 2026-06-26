import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootEnv = path.resolve(packageDir, "../../.env");

function loadEnvFile(filePath) {
  const env = { ...process.env };
  if (!existsSync(filePath)) return env;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    env[key] = value;
  }

  return env;
}

process.env.NODE_ENV = "development";

const env = loadEnvFile(rootEnv);
// API server listens on API_PORT (frontend uses PORT=5173 from the same .env)
env.PORT = env.API_PORT ?? "8080";
const build = spawnSync("pnpm", ["run", "build"], {
  stdio: "inherit",
  cwd: packageDir,
  env,
  shell: true,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const start = spawnSync("node", ["--enable-source-maps", "./dist/index.mjs"], {
  stdio: "inherit",
  cwd: packageDir,
  env,
  shell: true,
});

process.exit(start.status ?? 1);

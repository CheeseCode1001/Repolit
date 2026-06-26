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

const result = spawnSync(
  "vite",
  ["--config", "vite.config.ts", "--host", "0.0.0.0"],
  {
    stdio: "inherit",
    cwd: packageDir,
    env: loadEnvFile(rootEnv),
    shell: true,
  },
);

process.exit(result.status ?? 1);

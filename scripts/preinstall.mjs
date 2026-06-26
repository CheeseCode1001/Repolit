import { unlinkSync } from "node:fs";

function isPnpmInstall() {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const execPath = (process.env.npm_execpath ?? "").replace(/\\/g, "/");
  return (
    userAgent.includes("pnpm/") ||
    /(?:^|[/\\])pnpm(?:\.cjs|\.js)?$/i.test(execPath) ||
    execPath.includes("/pnpm/")
  );
}

if (!isPnpmInstall()) {
  console.error("Use pnpm instead");
  process.exit(1);
}

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  try {
    unlinkSync(lockfile);
  } catch {
    // ignore missing files
  }
}

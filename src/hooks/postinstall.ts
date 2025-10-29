import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function detectPackageManager(dir: string): "npm" | "pnpm" | "yarn" | "bun" {
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "bun.lockb"))) return "bun";
  return "npm";
}

function pmExec(pm: "npm" | "pnpm" | "yarn" | "bun"): string {
  switch (pm) {
    case "pnpm":
      return "pnpm exec commitzero";
    case "yarn":
      return "yarn run commitzero";
    case "bun":
      return "bunx commitzero";
    default:
      return "npm exec commitzero";
  }
}

function safeParseJson(content: string): { name: string; scripts: Record<string, string> } | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function updateScripts(targetDir: string) {
  const pkgPath = join(targetDir, "package.json");
  if (!existsSync(pkgPath)) return;

  const raw = readFileSync(pkgPath, "utf8");
  const pkg = safeParseJson(raw);
  if (!pkg || typeof pkg !== "object") return;

  // Avoid modifying our own package during local development
  if (pkg.name === "@codemastersolutions/commitzero") return;

  const pm = detectPackageManager(targetDir);
  const exec = pmExec(pm);

  if (!pkg.scripts || typeof pkg.scripts !== "object") {
    pkg.scripts = {};
  }

  // Only add if missing; do not override existing user scripts
  if (!pkg.scripts["commitzero"]) {
    pkg.scripts["commitzero"] = "commitzero";
  }
  if (!pkg.scripts["commitzero:install"]) {
    pkg.scripts["commitzero:install"] = `${exec} install-hooks`;
  }
  if (!pkg.scripts["commitzero:uninstall"]) {
    pkg.scripts["commitzero:uninstall"] = `${exec} uninstall-hooks`;
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function findConsumerRoot(): string | null {
  const initCwd = process.env.INIT_CWD || "";
  if (initCwd && initCwd.trim()) return initCwd;
  // Fallback: ascend until we find a package.json that is not this package
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const raw = readFileSync(pkgPath, "utf8");
      const pkg = safeParseJson(raw);
      if (pkg && pkg.name !== "@codemastersolutions/commitzero") {
        return dir;
      }
    }
    const next = join(dir, "..");
    if (next === dir) break;
    dir = next;
  }
  return null;
}

try {
  const targetDir = findConsumerRoot();
  if (targetDir) updateScripts(targetDir);
} catch {
  // Be silent on failure to avoid breaking installs
}

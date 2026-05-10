import { accessSync, constants, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

function isExecutablePath(p: string): boolean {
  if (!p) return false;
  if (!existsSync(p)) return false;
  if (process.platform === "win32") return true;
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveFromEnvVar(varName: string): string | null {
  const v = process.env[varName];
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (!isAbsolute(trimmed)) return null;
  return isExecutablePath(trimmed) ? trimmed : null;
}

function resolveFromPath(name: string): string | null {
  const rawPath = process.env.PATH ?? "";
  const entries = rawPath
    .split(process.platform === "win32" ? ";" : ":")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const candidates =
    process.platform === "win32" ? [name, `${name}.cmd`, `${name}.exe`, `${name}.bat`] : [name];

  for (const dir of entries) {
    if (!isAbsolute(dir)) continue;
    for (const base of candidates) {
      const p = join(dir, base);
      if (isExecutablePath(p)) return p;
    }
  }
  return null;
}

export function resolveGitBin(): string {
  const fromEnv = resolveFromEnvVar("COMMITZERO_GIT_BIN");
  if (fromEnv) return fromEnv;

  const candidates: string[] =
    process.platform === "win32"
      ? [
          join(process.env.ProgramFiles ?? String.raw`C:\Program Files`, "Git", "bin", "git.exe"),
          join(
            process.env["ProgramFiles(x86)"] ?? String.raw`C:\Program Files (x86)`,
            "Git",
            "bin",
            "git.exe"
          ),
        ]
      : ["/usr/bin/git", "/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];

  for (const c of candidates) {
    if (isExecutablePath(c)) return c;
  }

  throw new Error(
    "Git executable not found. Set COMMITZERO_GIT_BIN to an absolute path to your git binary."
  );
}

export function resolveNpmBin(): string {
  const fromEnv = resolveFromEnvVar("COMMITZERO_NPM_BIN");
  if (fromEnv) return fromEnv;

  const nodeBinDir = dirname(process.execPath);
  const fromNodeDir =
    process.platform === "win32" ? join(nodeBinDir, "npm.cmd") : join(nodeBinDir, "npm");
  if (isExecutablePath(fromNodeDir)) return fromNodeDir;

  const candidates: string[] =
    process.platform === "win32"
      ? [
          join(nodeBinDir, "npm.cmd"),
          join(nodeBinDir, "npm.exe"),
          join(process.env.ProgramFiles ?? String.raw`C:\Program Files`, "nodejs", "npm.cmd"),
        ]
      : ["/usr/bin/npm", "/bin/npm", "/usr/local/bin/npm", "/opt/homebrew/bin/npm"];

  for (const c of candidates) {
    if (isExecutablePath(c)) return c;
  }

  throw new Error(
    "npm executable not found. Set COMMITZERO_NPM_BIN to an absolute path to your npm binary."
  );
}

export function resolvePnpmBin(): string {
  const fromEnv = resolveFromEnvVar("COMMITZERO_PNPM_BIN");
  if (fromEnv) return fromEnv;

  const nodeBinDir = dirname(process.execPath);
  const fromNodeDir =
    process.platform === "win32" ? join(nodeBinDir, "pnpm.cmd") : join(nodeBinDir, "pnpm");
  if (isExecutablePath(fromNodeDir)) return fromNodeDir;

  const candidates: string[] =
    process.platform === "win32"
      ? [
          join(nodeBinDir, "pnpm.cmd"),
          join(nodeBinDir, "pnpm.exe"),
          join(process.env.ProgramFiles ?? String.raw`C:\Program Files`, "nodejs", "pnpm.cmd"),
        ]
      : ["/usr/bin/pnpm", "/bin/pnpm", "/usr/local/bin/pnpm", "/opt/homebrew/bin/pnpm"];

  for (const c of candidates) {
    if (isExecutablePath(c)) return c;
  }

  const fromPath = resolveFromPath("pnpm");
  if (fromPath) return fromPath;

  throw new Error(
    "pnpm executable not found. Set COMMITZERO_PNPM_BIN to an absolute path to your pnpm binary."
  );
}

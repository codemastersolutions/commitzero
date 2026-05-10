import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveGitBin } from "../utils/binaries.js";
import {
  commitMsgScript,
  HOOK_HEADER,
  preCommitScript,
  prepareCommitMsgScript,
} from "./scripts.js";

export interface HookOptions {
  hookDir?: string;
  forceOverride?: boolean;
}

function getGitBin(): string {
  return resolveGitBin();
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeHook(filePath: string, content: string) {
  writeFileSync(filePath, content, { encoding: "utf8", mode: 0o755 });
}

function removeManagedBlock(original: string): string {
  const start = `${HOOK_HEADER} START`;
  const end = `${HOOK_HEADER} END`;
  const lines = original.split(/\r?\n/);
  const out: string[] = [];
  let skip = false;
  for (const line of lines) {
    if (line.includes(start)) {
      skip = true;
      continue;
    }
    if (line.includes(end)) {
      skip = false;
      continue;
    }
    if (!skip) out.push(line);
  }
  return out.join("\n");
}

function isGitRepository(): boolean {
  try {
    execFileSync(getGitBin(), ["rev-parse", "--git-dir"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isProjectRoot(): boolean {
  return existsSync(join(process.cwd(), "package.json"));
}

export function getCurrentHooksPath(baseDir?: string): string | null {
  // Se um diretório base foi fornecido, só consideramos configuração local se for um
  // repositório Git real (presença de .git/config). Caso contrário, retornamos null.
  if (baseDir) {
    try {
      const hasLocalConfig = existsSync(join(baseDir, ".git", "config"));
      if (!hasLocalConfig) {
        return null;
      }
    } catch {
      return null;
    }
  }
  // Prioriza configuração local do repositório para evitar interferência de config global.
  // Em ambientes sem repositório inicializado, retorna null para usar `.git/hooks` padrão.
  try {
    const configuredLocal = execFileSync(
      getGitBin(),
      ["config", "--local", "--get", "core.hooksPath"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        cwd: baseDir ?? process.cwd(),
      }
    ).trim();
    if (configuredLocal) return configuredLocal;
  } catch {}
  try {
    const inside = execFileSync(getGitBin(), ["rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      cwd: baseDir ?? process.cwd(),
    }).trim();
    if (inside !== "true") return null;
  } catch {
    return null;
  }

  try {
    const configured = execFileSync(getGitBin(), ["config", "--local", "--get", "core.hooksPath"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      cwd: baseDir ?? process.cwd(),
    }).trim();
    return configured || null;
  } catch {
    return null;
  }
}

function removeHooksPath(): void {
  try {
    execFileSync(getGitBin(), ["config", "--unset", "core.hooksPath"], { stdio: "ignore" });
  } catch {
    // Ignore if already unset
  }
}

export function isCommitZeroHooksPath(path: string): boolean {
  return path === ".commitzero/hooks" || path.endsWith("/.commitzero/hooks");
}

function isDirectoryEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  try {
    const files = readdirSync(dir);
    return files.length === 0;
  } catch {
    return true;
  }
}

function hasOnlyCommitZeroHooks(dir: string): boolean {
  if (!existsSync(dir)) return true;
  try {
    const files = readdirSync(dir);
    const hookFiles = new Set(["commit-msg", "prepare-commit-msg", "pre-commit"]);

    for (const file of files) {
      if (!hookFiles.has(file)) return false;

      const filePath = join(dir, file);
      try {
        const content = readFileSync(filePath, "utf8");
        if (!content.includes(HOOK_HEADER)) return false;
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

function tryConfigureHooksPath(wantHooksPath: string): string | null {
  try {
    execFileSync(getGitBin(), ["config", "core.hooksPath", wantHooksPath], { stdio: "ignore" });
    return wantHooksPath;
  } catch {
    return null;
  }
}

function resolveHookDir(opts: HookOptions): string {
  if (opts.hookDir) return opts.hookDir;
  const currentHooksPath = getCurrentHooksPath();
  const wantCommitZeroPath = ".commitzero/hooks";
  if (!currentHooksPath) {
    return tryConfigureHooksPath(wantCommitZeroPath) ?? join(".git", "hooks");
  }
  if (opts.forceOverride && !isCommitZeroHooksPath(currentHooksPath)) {
    return tryConfigureHooksPath(wantCommitZeroPath) ?? currentHooksPath;
  }
  return currentHooksPath;
}

export function installHooks(opts: HookOptions = {}) {
  // Validate project root
  if (!isProjectRoot()) {
    throw new Error("Command must be run from project root (where package.json is located)");
  }

  // Validate git repository
  if (!isGitRepository()) {
    throw new Error(
      "Git repository not initialized. Run 'git init' first or use the --init-git flag"
    );
  }

  const hookDir = resolveHookDir(opts);

  ensureDir(hookDir);
  const commitMsgPath = join(hookDir, "commit-msg");
  const prepareMsgPath = join(hookDir, "prepare-commit-msg");
  const preCommitPath = join(hookDir, "pre-commit");

  writeHook(commitMsgPath, commitMsgScript());
  writeHook(prepareMsgPath, prepareCommitMsgScript());
  writeHook(preCommitPath, preCommitScript());
}

function resolveUninstallHookDir(opts: HookOptions): string {
  if (opts.hookDir) return opts.hookDir;
  const currentHooksPath = getCurrentHooksPath();
  if (!currentHooksPath) return join(".git", "hooks");
  return currentHooksPath.startsWith("/")
    ? currentHooksPath
    : join(process.cwd(), currentHooksPath);
}

function cleanupHookFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, "utf8");
    const cleaned = removeManagedBlock(content);
    writeHook(filePath, cleaned.trim() ? cleaned : "");
  } catch {}
}

export function uninstallHooks(opts: HookOptions = {}) {
  const hookDir = resolveUninstallHookDir(opts);

  const commitMsgPath = join(hookDir, "commit-msg");
  const prepareMsgPath = join(hookDir, "prepare-commit-msg");
  const preCommitPath = join(hookDir, "pre-commit");

  cleanupHookFile(commitMsgPath);
  cleanupHookFile(prepareMsgPath);
  cleanupHookFile(preCommitPath);

  // Check if we should remove the hooks directory and unset hooks path
  const currentHooksPath = getCurrentHooksPath();
  if (currentHooksPath && isCommitZeroHooksPath(currentHooksPath)) {
    if (hasOnlyCommitZeroHooks(hookDir) && isDirectoryEmpty(hookDir)) {
      try {
        rmSync(hookDir, { recursive: true, force: true });
        removeHooksPath();
      } catch {}
    }
  }
}

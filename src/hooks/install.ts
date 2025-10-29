import { mkdirSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { commitMsgScript, prepareCommitMsgScript, preCommitScript, HOOK_HEADER } from "./scripts";
import { execSync } from "node:child_process";

export interface HookOptions {
  hookDir?: string;
  forceOverride?: boolean;
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
    execSync("git rev-parse --git-dir", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isProjectRoot(): boolean {
  return existsSync(join(process.cwd(), "package.json"));
}

export function getCurrentHooksPath(): string | null {
  try {
    const configured = execSync("git config --get core.hooksPath", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return configured || null;
  } catch {
    return null;
  }
}

function setHooksPath(path: string): void {
  execSync(`git config core.hooksPath "${path}"`, { stdio: "ignore" });
}

function removeHooksPath(): void {
  try {
    execSync("git config --unset core.hooksPath", { stdio: "ignore" });
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
    const files = require("node:fs").readdirSync(dir);
    return files.length === 0;
  } catch {
    return true;
  }
}

function hasOnlyCommitZeroHooks(dir: string): boolean {
  if (!existsSync(dir)) return true;
  try {
    const files = require("node:fs").readdirSync(dir);
    const hookFiles = ["commit-msg", "prepare-commit-msg", "pre-commit"];
    
    // Check if all files are CommitZero hooks
    for (const file of files) {
      if (!hookFiles.includes(file)) return false;
      
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

export function installHooks(opts: HookOptions = {}) {
  // Validate project root
  if (!isProjectRoot()) {
    throw new Error("Command must be run from project root (where package.json is located)");
  }

  // Validate git repository
  if (!isGitRepository()) {
    throw new Error("Git repository not initialized. Run 'git init' first or use the --init-git flag");
  }

  const COMMITZERO_HOOKS_PATH = ".commitzero/hooks";
  let hookDir = opts.hookDir;
  
  if (!hookDir) {
    const currentHooksPath = getCurrentHooksPath();
    
    if (currentHooksPath) {
      // If current path is not CommitZero's and forceOverride is not set, ask for confirmation
      if (!isCommitZeroHooksPath(currentHooksPath) && !opts.forceOverride) {
        throw new Error(`Hooks path already configured: ${currentHooksPath}. Use --force to override`);
      }
      
      if (isCommitZeroHooksPath(currentHooksPath)) {
        hookDir = currentHooksPath;
      } else {
        // Override existing path
        hookDir = COMMITZERO_HOOKS_PATH;
        setHooksPath(hookDir);
      }
    } else {
      // No hooks path configured, set CommitZero's path
      hookDir = COMMITZERO_HOOKS_PATH;
      setHooksPath(hookDir);
    }
  }

  ensureDir(hookDir);
  const commitMsgPath = join(hookDir, "commit-msg");
  const prepareMsgPath = join(hookDir, "prepare-commit-msg");
  const preCommitPath = join(hookDir, "pre-commit");

  writeHook(commitMsgPath, commitMsgScript());
  writeHook(prepareMsgPath, prepareCommitMsgScript());
  writeHook(preCommitPath, preCommitScript());
}

export function uninstallHooks(opts: HookOptions = {}) {
  const COMMITZERO_HOOKS_PATH = ".commitzero/hooks";
  let hookDir = opts.hookDir;
  
  if (!hookDir) {
    const currentHooksPath = getCurrentHooksPath();
    if (currentHooksPath) {
      hookDir = currentHooksPath.startsWith("/") ? currentHooksPath : join(process.cwd(), currentHooksPath);
    } else {
      hookDir = join(".git", "hooks");
    }
  }

  const commitMsgPath = join(hookDir, "commit-msg");
  const prepareMsgPath = join(hookDir, "prepare-commit-msg");
  const preCommitPath = join(hookDir, "pre-commit");

  try {
    const c = readFileSync(commitMsgPath, "utf8");
    const cleaned = removeManagedBlock(c);
    if (cleaned.trim()) {
      writeHook(commitMsgPath, cleaned);
    } else {
      rmSync(commitMsgPath, { force: true });
    }
  } catch {}

  try {
    const p = readFileSync(prepareMsgPath, "utf8");
    const cleaned = removeManagedBlock(p);
    if (cleaned.trim()) {
      writeHook(prepareMsgPath, cleaned);
    } else {
      rmSync(prepareMsgPath, { force: true });
    }
  } catch {}

  try {
    const pc = readFileSync(preCommitPath, "utf8");
    const cleaned = removeManagedBlock(pc);
    if (cleaned.trim()) {
      writeHook(preCommitPath, cleaned);
    } else {
      rmSync(preCommitPath, { force: true });
    }
  } catch {}

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

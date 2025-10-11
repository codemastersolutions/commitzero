import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { commitMsgScript, prepareCommitMsgScript, HOOK_HEADER } from "./scripts";

export interface HookOptions {
  hookDir?: string; // default .git/hooks
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

export function installHooks(opts: HookOptions = {}) {
  const hookDir = opts.hookDir ?? join(".git", "hooks");
  ensureDir(hookDir);
  const commitMsgPath = join(hookDir, "commit-msg");
  const prepareMsgPath = join(hookDir, "prepare-commit-msg");

  writeHook(commitMsgPath, commitMsgScript());
  writeHook(prepareMsgPath, prepareCommitMsgScript());
}

export function uninstallHooks(opts: HookOptions = {}) {
  const hookDir = opts.hookDir ?? join(".git", "hooks");
  const commitMsgPath = join(hookDir, "commit-msg");
  const prepareMsgPath = join(hookDir, "prepare-commit-msg");

  try {
    const c = readFileSync(commitMsgPath, "utf8");
    const cleaned = removeManagedBlock(c);
    writeHook(commitMsgPath, cleaned);
  } catch {}

  try {
    const p = readFileSync(prepareMsgPath, "utf8");
    const cleaned = removeManagedBlock(p);
    writeHook(prepareMsgPath, cleaned);
  } catch {}
}
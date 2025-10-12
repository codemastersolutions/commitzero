import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { HOOK_HEADER } from "./scripts";

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

function findProjectRoot(start: string): string {
  let dir = start;
  // Walk up until filesystem root to find a directory with .git/hooks
  // Works with pnpm's nested node_modules/.pnpm structure and symlinks
  // Stops at the first directory containing .git/hooks
  while (true) {
    const hooksDir = join(dir, ".git", "hooks");
    if (existsSync(hooksDir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export function cleanupHooks(cwd?: string) {
  const start = cwd || process.env.INIT_CWD || process.cwd();
  const root = findProjectRoot(start);
  const hookDir = join(root, ".git", "hooks");
  const commitMsgPath = join(hookDir, "commit-msg");
  const prepareMsgPath = join(hookDir, "prepare-commit-msg");

  try {
    if (existsSync(commitMsgPath)) {
      const c = readFileSync(commitMsgPath, "utf8");
      const cleaned = removeManagedBlock(c);
      writeFileSync(commitMsgPath, cleaned, { encoding: "utf8", mode: 0o755 });
    }
  } catch {}

  try {
    if (existsSync(prepareMsgPath)) {
      const p = readFileSync(prepareMsgPath, "utf8");
      const cleaned = removeManagedBlock(p);
      writeFileSync(prepareMsgPath, cleaned, { encoding: "utf8", mode: 0o755 });
    }
  } catch {}
}

// Allow running directly: node dist/cjs/hooks/cleanup.js
if (require.main === module) {
  cleanupHooks();
}
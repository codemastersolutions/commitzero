import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getCurrentHooksPath } from "./install";
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
  const configured = getCurrentHooksPath();
  const hookDir = configured
    ? configured.startsWith("/")
      ? configured
      : join(root, configured)
    : join(root, ".git", "hooks");
  const commitMsgPath = join(hookDir, "commit-msg");
  const prepareMsgPath = join(hookDir, "prepare-commit-msg");
  const preCommitPath = join(hookDir, "pre-commit");

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

  try {
    if (existsSync(preCommitPath)) {
      const pc = readFileSync(preCommitPath, "utf8");
      const cleaned = removeManagedBlock(pc);
      writeFileSync(preCommitPath, cleaned, { encoding: "utf8", mode: 0o755 });
    }
  } catch {}

  // Intencionalmente não remove scripts do package.json.
  // A desinstalação dos hooks deve apenas limpar os blocos gerenciados nos arquivos de hook.
}

if (require.main === module) {
  cleanupHooks();
}

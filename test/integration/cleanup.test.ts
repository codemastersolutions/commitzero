import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { resolveGitBin } from "../../dist/esm/utils/binaries.js";

const CLI = join(process.cwd(), "dist", "esm", "cli", "index.js");
const NODE = process.execPath;
const GIT = resolveGitBin();

const HOOK_HEADER = "# CommitZero managed block";

const managedBlock = `${HOOK_HEADER} START\n# begin\necho managed\n# end\n${HOOK_HEADER} END\n`;

test("cleanup removes managed blocks in hooks directory", () => {
  const tmp = join(process.cwd(), "tmp-cleanup");
  const hooksDir = join(tmp, ".git", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, "pre-commit");
  writeFileSync(hookPath, `#!/bin/sh\n${managedBlock}\necho custom`, {
    encoding: "utf8",
  });

  try {
    const out = execFileSync(NODE, [CLI, "cleanup"], { encoding: "utf8", cwd: tmp });
    assert.match(
      out,
      /Managed blocks removed from hooks|Blocos gerenciados removidos dos hooks|Bloques administrados removidos de los hooks/
    );
    const content = readFileSync(hookPath, "utf8");
    assert.ok(!content.includes(HOOK_HEADER), "managed block header should be removed");
    assert.match(content, /echo custom/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("cleanup finds project root from nested directory and cleans commit-msg and prepare-commit-msg", () => {
  const tmp = join(process.cwd(), "tmp-cleanup-nested");
  mkdirSync(tmp, { recursive: true });
  try {
    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });
    const hooksDir = join(tmp, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const commitMsgPath = join(hooksDir, "commit-msg");
    const preparePath = join(hooksDir, "prepare-commit-msg");
    writeFileSync(commitMsgPath, `#!/bin/sh\n${managedBlock}\necho custom`, { encoding: "utf8" });
    writeFileSync(preparePath, `#!/bin/sh\n${managedBlock}\necho custom`, { encoding: "utf8" });

    const nested = join(tmp, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    execFileSync(NODE, [CLI, "cleanup"], { encoding: "utf8", cwd: nested });

    assert.ok(!readFileSync(commitMsgPath, "utf8").includes(HOOK_HEADER));
    assert.ok(!readFileSync(preparePath, "utf8").includes(HOOK_HEADER));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("cleanup respects configured hooksPath (relative and absolute)", () => {
  const tmp = join(process.cwd(), "tmp-cleanup-hooks-path");
  mkdirSync(tmp, { recursive: true });
  try {
    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });

    const relHooksDir = join(tmp, "custom-hooks");
    mkdirSync(relHooksDir, { recursive: true });
    execFileSync(GIT, ["config", "core.hooksPath", "custom-hooks"], { cwd: tmp, stdio: "ignore" });
    const relHook = join(relHooksDir, "commit-msg");
    writeFileSync(relHook, `#!/bin/sh\n${managedBlock}\necho custom`, { encoding: "utf8" });

    execFileSync(NODE, [CLI, "cleanup"], { encoding: "utf8", cwd: tmp });
    assert.ok(!readFileSync(relHook, "utf8").includes(HOOK_HEADER));

    const absHooksDir = join(tmp, "abs-hooks");
    mkdirSync(absHooksDir, { recursive: true });
    execFileSync(GIT, ["config", "core.hooksPath", absHooksDir], { cwd: tmp, stdio: "ignore" });
    const absHook = join(absHooksDir, "pre-commit");
    writeFileSync(absHook, `#!/bin/sh\n${managedBlock}\necho custom`, { encoding: "utf8" });

    execFileSync(NODE, [CLI, "cleanup"], { encoding: "utf8", cwd: tmp });
    assert.ok(!readFileSync(absHook, "utf8").includes(HOOK_HEADER));
    assert.ok(existsSync(absHooksDir));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

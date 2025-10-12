import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const CLI = join(process.cwd(), "dist", "cjs", "cli", "index.js");

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
    const out = execSync(`node ${CLI} cleanup`, { encoding: "utf8", cwd: tmp });
    assert.match(
      out,
      /Managed blocks removed from hooks|Blocos gerenciados removidos dos hooks|Bloques administrados removidos de los hooks/
    );
    const content = readFileSync(hookPath, "utf8");
    assert.ok(
      !content.includes(HOOK_HEADER),
      "managed block header should be removed"
    );
    assert.match(content, /echo custom/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

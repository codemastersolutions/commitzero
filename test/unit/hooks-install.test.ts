import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getCurrentHooksPath, installHooks, uninstallHooks } from "../../dist/esm/hooks/install.js";
import { resolveGitBin } from "../../dist/esm/utils/binaries.js";

const GIT = resolveGitBin();

function getGitConfig(cwd: string, key: string): string | null {
  try {
    const v = execFileSync(GIT, ["config", "--local", "--get", key], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return v || null;
  } catch {
    return null;
  }
}

test("installHooks throws when not a git repository", () => {
  const prevCwd = process.cwd();
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-hooks-install-"));
  try {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    process.chdir(tmp);
    assert.throws(() => installHooks(), /Git repository not initialized/i);
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("installHooks throws when not run from project root", () => {
  const prevCwd = process.cwd();
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-hooks-not-root-"));
  try {
    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });
    process.chdir(tmp);
    assert.throws(() => installHooks(), /project root/i);
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("installHooks configures core.hooksPath when unset and writes hook files", () => {
  const prevCwd = process.cwd();
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-hooks-install-ok-"));
  try {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });
    process.chdir(tmp);

    installHooks();

    const hooksPath = getGitConfig(tmp, "core.hooksPath");
    assert.ok(hooksPath === ".commitzero/hooks" || hooksPath === ".git/hooks");
    const dir = hooksPath ?? ".git/hooks";
    assert.ok(existsSync(join(tmp, dir, "commit-msg")));
    assert.ok(existsSync(join(tmp, dir, "prepare-commit-msg")));
    assert.ok(existsSync(join(tmp, dir, "pre-commit")));

    const content = readFileSync(join(tmp, dir, "commit-msg"), "utf8");
    assert.match(content, /CommitZero managed block/);
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("installHooks respects existing hooksPath unless forceOverride is set", () => {
  const prevCwd = process.cwd();
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-hooks-existing-"));
  try {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });
    execFileSync(GIT, ["config", "core.hooksPath", "custom-hooks"], { cwd: tmp, stdio: "ignore" });
    mkdirSync(join(tmp, "custom-hooks"), { recursive: true });
    process.chdir(tmp);

    installHooks();
    assert.strictEqual(getGitConfig(tmp, "core.hooksPath"), "custom-hooks");
    assert.ok(existsSync(join(tmp, "custom-hooks", "commit-msg")));

    installHooks({ forceOverride: true });
    const overridden = getGitConfig(tmp, "core.hooksPath");
    assert.ok(overridden === ".commitzero/hooks" || overridden === "custom-hooks");
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("getCurrentHooksPath(baseDir) returns null when no .git/config exists", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-hooks-nogit-"));
  try {
    assert.strictEqual(getCurrentHooksPath(tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("uninstallHooks unsets core.hooksPath when it points to commitzero but hooks dir is missing", () => {
  const prevCwd = process.cwd();
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-hooks-uninstall-"));
  try {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });
    execFileSync(GIT, ["config", "core.hooksPath", ".commitzero/hooks"], {
      cwd: tmp,
      stdio: "ignore",
    });
    mkdirSync(join(tmp, ".commitzero"), { recursive: true });

    process.chdir(tmp);
    uninstallHooks();

    try {
      const v = execFileSync(GIT, ["config", "--local", "--get", "core.hooksPath"], {
        cwd: tmp,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      assert.fail(`expected core.hooksPath to be unset, but got: ${v}`);
    } catch {}
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("uninstallHooks removes empty commitzero hooks dir and unsets core.hooksPath", () => {
  const prevCwd = process.cwd();
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-hooks-uninstall-empty-"));
  try {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });
    execFileSync(GIT, ["config", "core.hooksPath", ".commitzero/hooks"], {
      cwd: tmp,
      stdio: "ignore",
    });
    mkdirSync(join(tmp, ".commitzero", "hooks"), { recursive: true });

    process.chdir(tmp);
    uninstallHooks();

    assert.strictEqual(getGitConfig(tmp, "core.hooksPath"), null);
    assert.strictEqual(existsSync(join(tmp, ".commitzero", "hooks")), false);
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("uninstallHooks removes managed blocks from hook files in an absolute hooksPath", () => {
  const prevCwd = process.cwd();
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-hooks-uninstall-abs-"));
  try {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "t" }), "utf8");
    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });

    const hooksDir = join(tmp, "abs-hooks");
    mkdirSync(hooksDir, { recursive: true });
    execFileSync(GIT, ["config", "core.hooksPath", hooksDir], { cwd: tmp, stdio: "ignore" });

    const hookPath = join(hooksDir, "commit-msg");
    writeFileSync(
      hookPath,
      [
        "#!/bin/sh",
        "echo before",
        "# CommitZero managed block START",
        "echo managed",
        "# CommitZero managed block END",
        "echo after",
        "",
      ].join("\n"),
      "utf8"
    );

    process.chdir(tmp);
    uninstallHooks();

    const content = readFileSync(hookPath, "utf8");
    assert.doesNotMatch(content, /CommitZero managed block/);
    assert.match(content, /echo before/);
    assert.match(content, /echo after/);
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

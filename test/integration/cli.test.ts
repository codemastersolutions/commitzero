import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
const CLI = join(process.cwd(), "dist", "esm", "cli", "index.js");
const NODE = process.execPath;

test("lint valid message via CLI", () => {
  const tmp = join(process.cwd(), "tmp-cli-lint-ok");
  mkdirSync(tmp, { recursive: true });
  const msg = "feat: ok";
  try {
    const file = join(tmp, "tmp-msg.txt");
    writeFileSync(file, msg, "utf8");
    const out = execFileSync(NODE, [CLI, "lint", "--file", "tmp-msg.txt"], {
      encoding: "utf8",
      cwd: tmp,
    });
    assert.match(out, /Valid commit/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("lint invalid: missing blank line before body via --file", () => {
  const tmp = join(process.cwd(), "tmp-cli-lint-no-blank");
  mkdirSync(tmp, { recursive: true });
  const msg = "feat(core): change\nBody without blank line";
  const file = join(tmp, "tmp-commit-no-blank.txt");
  writeFileSync(file, msg, "utf8");
  try {
    try {
      execFileSync(NODE, [CLI, "lint", "--file", file], { encoding: "utf8", cwd: tmp });
      assert.fail("expected CLI to exit with error for missing blank line");
    } catch (err: any) {
      const output = String(err.stdout || err.stderr || "");
      assert.match(output, /blank line required between header and body/);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("lint valid: blank line before body via --file", () => {
  const tmp = join(process.cwd(), "tmp-cli-lint-with-blank");
  mkdirSync(tmp, { recursive: true });
  const msg = "feat(core): change\n\nBody with blank line";
  const file = join(tmp, "tmp-commit-with-blank.txt");
  writeFileSync(file, msg, "utf8");
  try {
    const out = execFileSync(NODE, [CLI, "lint", "--file", file], {
      encoding: "utf8",
      cwd: tmp,
    });
    assert.match(out, /Valid commit/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("help output with --help and no args", () => {
  const tmp = join(process.cwd(), "tmp-cli-help");
  mkdirSync(tmp, { recursive: true });
  try {
    const out1 = execFileSync(NODE, [CLI, "--help"], { encoding: "utf8", cwd: tmp });
    assert.match(out1, /CommitZero CLI/);
    const out2 = execFileSync(NODE, [CLI], { encoding: "utf8", cwd: tmp });
    assert.match(out2, /CommitZero CLI/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("lint without input shows guidance", () => {
  const tmp = join(process.cwd(), "tmp-cli-lint-no-input");
  mkdirSync(tmp, { recursive: true });
  try {
    execFileSync(NODE, [CLI, "lint"], { encoding: "utf8", cwd: tmp });
    assert.fail("expected CLI to error without --file or -m");
  } catch (err: any) {
    const output = String((err.stdout || "") + (err.stderr || ""));
    assert.match(
      output,
      /Provide --file <path> or -m <message>|Forneça --file <path> ou -m <message>|Proporciona --file <path> o -m <message>/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("lint via -m valid and invalid", () => {
  const tmp = join(process.cwd(), "tmp-cli-lint-arg");
  mkdirSync(tmp, { recursive: true });
  try {
    const ok = execFileSync(NODE, [CLI, "lint", "-m", "feat: add feature"], {
      encoding: "utf8",
      cwd: tmp,
    });
    assert.match(ok, /Valid commit/);
    try {
      execFileSync(NODE, [CLI, "lint", "-m", "feat: bad\nno blank"], {
        encoding: "utf8",
        cwd: tmp,
      });
      assert.fail("expected CLI to exit with error for missing blank line");
    } catch (err: any) {
      const output = String((err.stdout || "") + (err.stderr || ""));
      assert.match(output, /blank line required between header and body/);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("flag guard: -a and --push only valid with commit", () => {
  const tmp = join(process.cwd(), "tmp-cli-flag-guard");
  mkdirSync(tmp, { recursive: true });
  try {
    execFileSync(NODE, [CLI, "-a"], { encoding: "utf8", cwd: tmp });
    assert.fail("expected CLI to reject -a without commit");
  } catch (err: any) {
    const output = String((err.stdout || "") + (err.stderr || ""));
    assert.match(
      output,
      /Flags -a\/--add, -p\/--push(?:, --progress-off(?: and --no-alt-screen)?)? are only valid|Flags -a\/--add and -p\/--push are only valid/
    );
  }
  try {
    execFileSync(NODE, [CLI, "--push"], { encoding: "utf8", cwd: tmp });
    assert.fail("expected CLI to reject --push without commit");
  } catch (err: any) {
    const output = String((err.stdout || "") + (err.stderr || ""));
    assert.match(
      output,
      /Flags -a\/--add, -p\/--push(?:, --progress-off(?: and --no-alt-screen)?)? are only valid|Flags -a\/--add and -p\/--push are only valid/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("check command reads .git/COMMIT_EDITMSG", () => {
  const tmp = join(process.cwd(), "tmp-wd-check");
  const gitDir = join(tmp, ".git");
  mkdirSync(gitDir, { recursive: true });
  const editPath = join(gitDir, "COMMIT_EDITMSG");
  try {
    writeFileSync(editPath, "feat: ok", "utf8");
    const out = execFileSync(NODE, [CLI, "check"], { encoding: "utf8", cwd: tmp });

    assert.ok(typeof out === "string");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("check without COMMIT_EDITMSG prints error", () => {
  const tmp = join(process.cwd(), "tmp-wd-check-missing");
  const gitDir = join(tmp, ".git");
  mkdirSync(gitDir, { recursive: true });
  try {
    try {
      execFileSync(NODE, [CLI, "check"], { encoding: "utf8", cwd: tmp });
      assert.fail("expected check to error without COMMIT_EDITMSG");
    } catch (err: any) {
      const output = String((err.stdout || "") + (err.stderr || ""));
      assert.match(
        output,
        /Could not read COMMIT_EDITMSG|Não foi possível ler COMMIT_EDITMSG|No se pudo leer COMMIT_EDITMSG/
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("check blocks direct git commit when enforceCommitZero enabled", () => {
  const tmp = join(process.cwd(), "tmp-wd-check-enforce");
  const gitDir = join(tmp, ".git");
  mkdirSync(gitDir, { recursive: true });
  writeFileSync(
    join(tmp, "commitzero.config.json"),
    JSON.stringify({ enforceCommitZero: true }),
    "utf8"
  );
  writeFileSync(join(gitDir, "COMMIT_EDITMSG"), "feat: ok", "utf8");
  try {
    try {
      execFileSync(NODE, [CLI, "check"], { encoding: "utf8", cwd: tmp });
      assert.fail(
        "expected check to fail when enforceCommitZero is enabled without COMMITZERO env"
      );
    } catch (err: any) {
      const output = String((err.stdout || "") + (err.stderr || ""));
      assert.match(
        output,
        /CommitZero is required|CommitZero é obrigatório|CommitZero es obligatorio/
      );
    }

    execFileSync(NODE, [CLI, "check"], {
      encoding: "utf8",
      cwd: tmp,
      env: { ...process.env, COMMITZERO: "1", COMMITZERO_RUN: "1" },
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("install-hooks and uninstall-hooks manage hooks content", () => {
  const tmp = join(process.cwd(), "tmp-wd-hooks");
  const gitDir = join(tmp, ".git");
  const hooksDir = join(tmp, ".commitzero", "hooks");
  const packageJsonPath = join(tmp, "package.json");
  mkdirSync(hooksDir, { recursive: true });

  writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: "test-project",
        scripts: {
          commitzero: "commitzero",
          "commitzero:install": "yarn run commitzero install-hooks",
          "commitzero:uninstall": "yarn run commitzero uninstall-hooks",
        },
      },
      null,
      2
    )
  );

  execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["config", "core.hooksPath", ".commitzero/hooks"], { cwd: tmp, stdio: "ignore" });

  try {
    const outInstall = execFileSync(NODE, [CLI, "install-hooks"], {
      encoding: "utf8",
      cwd: tmp,
    });
    assert.match(outInstall, /Hooks installed/);
    const commitMsgPath = join(hooksDir, "commit-msg");
    const preparePath = join(hooksDir, "prepare-commit-msg");
    assert.ok(existsSync(commitMsgPath));
    assert.ok(existsSync(preparePath));
    const cmContent = readFileSync(commitMsgPath, "utf8");
    const prepContent = readFileSync(preparePath, "utf8");
    assert.match(cmContent, /# CommitZero managed block/);
    assert.match(prepContent, /# CommitZero managed block/);

    const outUninstall = execFileSync(NODE, [CLI, "uninstall-hooks"], {
      encoding: "utf8",
      cwd: tmp,
    });
    assert.match(outUninstall, /Managed blocks removed from hooks/);
    const cmAfter = readFileSync(commitMsgPath, "utf8");
    const prepAfter = readFileSync(preparePath, "utf8");
    assert.doesNotMatch(cmAfter, /CommitZero managed block/);
    assert.doesNotMatch(prepAfter, /CommitZero managed block/);

    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const scripts = pkg.scripts || {};
    assert.ok("commitzero" in scripts);
    assert.ok("commitzero:install" in scripts);
    assert.ok("commitzero:uninstall" in scripts);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(gitDir, { recursive: true, force: true });
  }
});

test("init creates commitzero.config.json with defaults", () => {
  const tmp = join(process.cwd(), "tmp-wd-init");
  mkdirSync(tmp, { recursive: true });
  try {
    const out1 = execFileSync(NODE, [CLI, "init"], { encoding: "utf8", cwd: tmp });
    assert.match(out1, /created/i);
    const cfgPath = join(tmp, "commitzero.config.json");
    assert.ok(existsSync(cfgPath));

    const content = readFileSync(cfgPath, "utf8");
    const config = JSON.parse(content);
    assert.strictEqual(config.maxFileSize, "2MB");

    const out2 = execFileSync(NODE, [CLI, "init"], { encoding: "utf8", cwd: tmp });
    assert.match(out2.toLowerCase(), /already exists|já existe|ya existe/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

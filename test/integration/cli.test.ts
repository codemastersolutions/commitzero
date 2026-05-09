import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { resolveGitBin } from "../../dist/esm/utils/binaries.js";
const CLI = join(process.cwd(), "dist", "esm", "cli", "index.js");
const NODE = process.execPath;
const GIT = resolveGitBin();

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

test("unknown command prints help", () => {
  const tmp = join(process.cwd(), "tmp-cli-unknown");
  mkdirSync(tmp, { recursive: true });
  try {
    const out = execFileSync(NODE, [CLI, "unknown-subcommand"], { encoding: "utf8", cwd: tmp });
    assert.match(out, /CommitZero CLI/);
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
    const output = String(err.stdout) + String(err.stderr);
    assert.match(
      output,
      /Provide --file <path> or -m <message>|Forneça --file <path> ou -m <message>|Proporciona --file <path> o -m <message>/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("lint with missing --file triggers top-level error handler", () => {
  const tmp = join(process.cwd(), "tmp-cli-lint-missing-file");
  mkdirSync(tmp, { recursive: true });
  try {
    execFileSync(NODE, [CLI, "lint", "--file", "does-not-exist.txt"], {
      encoding: "utf8",
      cwd: tmp,
    });
    assert.fail("expected CLI to exit with error for missing file");
  } catch (err: any) {
    const code = typeof err?.status === "number" ? err.status : undefined;
    assert.strictEqual(code, 2);
    const output = String(err.stdout) + String(err.stderr);
    assert.match(output, /ENOENT|no such file or directory/i);
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
      const output = String(err.stdout) + String(err.stderr);
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
    const output = String(err.stdout) + String(err.stderr);
    assert.match(
      output,
      /Flags -a\/--add, -p\/--push(?:, --progress-off(?: and --no-alt-screen)?)? are only valid|Flags -a\/--add and -p\/--push are only valid/
    );
  }
  try {
    execFileSync(NODE, [CLI, "--push"], { encoding: "utf8", cwd: tmp });
    assert.fail("expected CLI to reject --push without commit");
  } catch (err: any) {
    const output = String(err.stdout) + String(err.stderr);
    assert.match(
      output,
      /Flags -a\/--add, -p\/--push(?:, --progress-off(?: and --no-alt-screen)?)? are only valid|Flags -a\/--add and -p\/--push are only valid/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("flag guard: --progress-off and --no-alt-screen only valid with commit", () => {
  const tmp = join(process.cwd(), "tmp-cli-flag-guard-2");
  mkdirSync(tmp, { recursive: true });
  try {
    try {
      execFileSync(NODE, [CLI, "--progress-off"], { encoding: "utf8", cwd: tmp });
      assert.fail("expected CLI to reject --progress-off without commit");
    } catch (err: any) {
      const code = typeof err?.status === "number" ? err.status : undefined;
      assert.strictEqual(code, 2);
    }
    try {
      execFileSync(NODE, [CLI, "--no-alt-screen"], { encoding: "utf8", cwd: tmp });
      assert.fail("expected CLI to reject --no-alt-screen without commit");
    } catch (err: any) {
      const code = typeof err?.status === "number" ? err.status : undefined;
      assert.strictEqual(code, 2);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("version check can be disabled via config and invalid period falls back to daily", () => {
  const tmp = join(process.cwd(), "tmp-cli-versioncheck-off");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(
      join(tmp, "commitzero.config.json"),
      JSON.stringify(
        { commitZero: { versionCheckEnabled: false, versionCheckPeriod: "yearly" } },
        null,
        2
      ),
      "utf8"
    );
    const out = execFileSync(NODE, [CLI, "lint", "-m", "feat: ok"], { encoding: "utf8", cwd: tmp });
    assert.match(out, /Valid commit/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("commit parses flags and timeout (non-interactive)", () => {
  const tmp = join(process.cwd(), "tmp-cli-commit-flags");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(
      join(tmp, "commitzero.config.json"),
      JSON.stringify({ versionCheckEnabled: false, language: "en" }, null, 2),
      "utf8"
    );

    execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });
    execFileSync(GIT, ["config", "user.email", "test@example.com"], { cwd: tmp, stdio: "ignore" });
    execFileSync(GIT, ["config", "user.name", "Test User"], { cwd: tmp, stdio: "ignore" });

    writeFileSync(join(tmp, "file.txt"), "content", "utf8");
    execFileSync(GIT, ["add", "file.txt"], { cwd: tmp, stdio: "ignore" });

    execFileSync(
      NODE,
      [CLI, "commit", "--add", "--progress-off", "--no-alt-screen", "--timeout", "100"],
      {
        encoding: "utf8",
        cwd: tmp,
        env: {
          ...process.env,
          NODE_TEST: "1",
          COMMITSKIP_SELECT_PROMPT: "1",
          COMMITZERO_TEST_ANSWERS: JSON.stringify(["core", "add login", "", "n"]),
          COMMITZERO: "1",
          COMMITZERO_RUN: "1",
        },
      }
    );

    const msg = execFileSync(GIT, ["log", "-1", "--pretty=%B"], { cwd: tmp, encoding: "utf8" });
    assert.match(msg, /feat\(core\): add login/);
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
      const output = String(err.stdout) + String(err.stderr);
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
      const output = String(err.stdout) + String(err.stderr);
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

  execFileSync(GIT, ["init"], { cwd: tmp, stdio: "ignore" });
  execFileSync(GIT, ["config", "core.hooksPath", ".commitzero/hooks"], {
    cwd: tmp,
    stdio: "ignore",
  });

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

test("install-hooks without git and without --init-git errors in non-interactive mode", () => {
  const tmp = join(process.cwd(), "tmp-wd-hooks-no-git");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "t" }, null, 2), "utf8");
    try {
      execFileSync(NODE, [CLI, "install-hooks"], { encoding: "utf8", cwd: tmp });
      assert.fail("expected install-hooks to exit with error when git is not initialized");
    } catch (err: any) {
      const code = typeof err?.status === "number" ? err.status : undefined;
      assert.strictEqual(code, 1);
      const output = String(err.stdout) + String(err.stderr);
      assert.match(
        output,
        /Git is not initialized|Git não está inicializado|Git no está inicializado/
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("install-hooks with --init-git initializes git and updates package scripts", () => {
  const tmp = join(process.cwd(), "tmp-wd-hooks-init-git");
  mkdirSync(tmp, { recursive: true });
  try {
    const packageJsonPath = join(tmp, "package.json");
    writeFileSync(packageJsonPath, JSON.stringify({ name: "t" }, null, 2) + "\n", "utf8");

    const out = execFileSync(NODE, [CLI, "install-hooks", "--init-git"], {
      encoding: "utf8",
      cwd: tmp,
    });
    assert.match(out, /Hooks installed/);

    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    assert.ok(pkg.scripts?.commitzero);
    assert.ok(pkg.scripts?.["commitzero:install"]);
    assert.ok(pkg.scripts?.["commitzero:uninstall"]);

    assert.ok(existsSync(join(tmp, ".git")));
    assert.ok(
      existsSync(join(tmp, ".commitzero", "hooks")) || existsSync(join(tmp, ".git", "hooks"))
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("pre-commit add fails when only JS config exists", () => {
  const tmp = join(process.cwd(), "tmp-wd-precommit-js-config");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(
      join(tmp, "commitzero.config.js"),
      "module.exports = { preCommitCommands: [] };\n",
      "utf8"
    );
    try {
      execFileSync(NODE, [CLI, "pre-commit", "add", "echo ok"], { encoding: "utf8", cwd: tmp });
      assert.fail("expected pre-commit add to exit with error when only JS config exists");
    } catch (err: any) {
      const code = typeof err?.status === "number" ? err.status : undefined;
      assert.strictEqual(code, 2);
      const output = String(err.stdout) + String(err.stderr);
      assert.match(
        output,
        /Editing requires JSON config|Edição requer configuração JSON|Edición requiere configuración JSON/
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
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

test("lint invalid with requireScope prints scoped example", () => {
  const tmp = join(process.cwd(), "tmp-cli-lint-require-scope");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(
      join(tmp, "commitzero.config.json"),
      JSON.stringify({ versionCheckEnabled: false, requireScope: true, language: "en" }, null, 2),
      "utf8"
    );
    try {
      execFileSync(NODE, [CLI, "lint", "-m", "feat: ok"], { encoding: "utf8", cwd: tmp });
      assert.fail("expected lint to fail when scope is required");
    } catch (err: any) {
      const output = String(err.stdout) + String(err.stderr);
      assert.match(output, /feat\(core\):/);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("check allows bypass during merge/rebase states when enforceCommitZero enabled", () => {
  const tmp = join(process.cwd(), "tmp-cli-check-allowed-noninteractive");
  const gitDir = join(tmp, ".git");
  mkdirSync(gitDir, { recursive: true });
  writeFileSync(join(gitDir, "COMMIT_EDITMSG"), "feat: ok", "utf8");
  writeFileSync(
    join(tmp, "commitzero.config.json"),
    JSON.stringify({ enforceCommitZero: true }),
    "utf8"
  );
  try {
    writeFileSync(join(gitDir, "MERGE_HEAD"), "x", "utf8");
    execFileSync(NODE, [CLI, "check"], { encoding: "utf8", cwd: tmp });

    rmSync(join(gitDir, "MERGE_HEAD"), { force: true });
    writeFileSync(join(gitDir, "MERGE_MSG"), "x", "utf8");
    execFileSync(NODE, [CLI, "check"], { encoding: "utf8", cwd: tmp });

    rmSync(join(gitDir, "MERGE_MSG"), { force: true });
    mkdirSync(join(gitDir, "rebase-apply"), { recursive: true });
    execFileSync(NODE, [CLI, "check"], { encoding: "utf8", cwd: tmp });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("version check can hit shouldPrompt branch without TTY when update is available", () => {
  const tmp = join(process.cwd(), "tmp-cli-versioncheck-prompt-branch");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(
      join(tmp, "commitzero.config.json"),
      JSON.stringify(
        { versionCheckEnabled: true, versionCheckPeriod: "daily", language: "en" },
        null,
        2
      ),
      "utf8"
    );

    const script = `
      import { createRequire } from "node:module";
      import { pathToFileURL } from "node:url";
      const require = createRequire(import.meta.url);
      const https = require("node:https");
      const { EventEmitter } = require("node:events");
      https.get = (_url, cb) => {
        const req = new EventEmitter();
        req.setTimeout = () => req;
        req.destroy = () => undefined;
        const res = new EventEmitter();
        res.statusCode = 200;
        res.resume = () => undefined;
        cb(res);
        process.nextTick(() => {
          res.emit("data", Buffer.from(JSON.stringify({ version: "999.0.0" }), "utf8"));
          res.emit("end");
        });
        return req;
      };
      await import(pathToFileURL(process.env.CLI_PATH).href);
    `.trim();

    const out = execFileSync(
      NODE,
      ["--input-type=module", "-e", script, "__cli__", "lint", "-m", "feat: ok"],
      { encoding: "utf8", cwd: tmp, env: { ...process.env, CLI_PATH: CLI } }
    );
    assert.match(out, /Valid commit/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("interactive update prompt: decline does not block command execution", () => {
  const tmp = join(process.cwd(), "tmp-cli-update-interactive-decline");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(join(tmp, "commitzero.config.json"), JSON.stringify({ language: "en" }, null, 2), "utf8");
    const script = `
      import { createRequire } from "node:module";
      import { pathToFileURL } from "node:url";
      const require = createRequire(import.meta.url);

      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      console.error = (...args) => console.log(...args);

      const readline = require("node:readline");
      readline.createInterface = () => ({
        question: (_prompt, cb) => cb(process.env.TEST_ANSWER || "n"),
        close: () => undefined,
      });

      const https = require("node:https");
      const { EventEmitter } = require("node:events");
      https.get = (_url, cb) => {
        const req = new EventEmitter();
        req.setTimeout = () => req;
        req.destroy = () => undefined;
        const res = new EventEmitter();
        res.statusCode = 200;
        res.resume = () => undefined;
        cb(res);
        process.nextTick(() => {
          res.emit("data", Buffer.from(JSON.stringify({ version: process.env.TEST_LATEST_VERSION }), "utf8"));
          res.emit("end");
        });
        return req;
      };

      await import(pathToFileURL(process.env.CLI_PATH).href);
    `.trim();

    const out = execFileSync(
      NODE,
      ["--input-type=module", "-e", script, "__cli__", "lint", "-m", "feat: ok"],
      {
        encoding: "utf8",
        cwd: tmp,
        env: { ...process.env, CLI_PATH: CLI, TEST_ANSWER: "n", TEST_LATEST_VERSION: "999.0.0" },
      }
    );
    assert.match(out, /Update declined/);
    assert.match(out, /Valid commit/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("interactive update prompt: accept triggers update success and exits 0", () => {
  const tmp = join(process.cwd(), "tmp-cli-update-interactive-accept");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(join(tmp, "commitzero.config.json"), JSON.stringify({ language: "en" }, null, 2), "utf8");
    const script = `
      import { createRequire } from "node:module";
      import { pathToFileURL } from "node:url";
      const require = createRequire(import.meta.url);

      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      console.error = (...args) => console.log(...args);

      const readline = require("node:readline");
      readline.createInterface = () => ({
        question: (_prompt, cb) => cb(process.env.TEST_ANSWER || "y"),
        close: () => undefined,
      });

      const child = require("node:child_process");
      child.execFileSync = () => undefined;

      const https = require("node:https");
      const { EventEmitter } = require("node:events");
      https.get = (_url, cb) => {
        const req = new EventEmitter();
        req.setTimeout = () => req;
        req.destroy = () => undefined;
        const res = new EventEmitter();
        res.statusCode = 200;
        res.resume = () => undefined;
        cb(res);
        process.nextTick(() => {
          res.emit("data", Buffer.from(JSON.stringify({ version: process.env.TEST_LATEST_VERSION }), "utf8"));
          res.emit("end");
        });
        return req;
      };

      await import(pathToFileURL(process.env.CLI_PATH).href);
    `.trim();

    const out = execFileSync(
      NODE,
      ["--input-type=module", "-e", script, "__cli__", "lint", "-m", "feat: ok"],
      {
        encoding: "utf8",
        cwd: tmp,
        env: { ...process.env, CLI_PATH: CLI, TEST_ANSWER: "y", TEST_LATEST_VERSION: "999.0.0" },
      }
    );
    assert.match(out, /Updating to version 999\.0\.0/);
    assert.match(out, /Library updated to 999\.0\.0/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("interactive update prompt: unsafe version triggers update failed and continues", () => {
  const tmp = join(process.cwd(), "tmp-cli-update-interactive-unsafe");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(join(tmp, "commitzero.config.json"), JSON.stringify({ language: "en" }, null, 2), "utf8");
    const script = `
      import { createRequire } from "node:module";
      import { pathToFileURL } from "node:url";
      const require = createRequire(import.meta.url);

      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      console.error = (...args) => console.log(...args);

      const readline = require("node:readline");
      readline.createInterface = () => ({
        question: (_prompt, cb) => cb(process.env.TEST_ANSWER || "y"),
        close: () => undefined,
      });

      const child = require("node:child_process");
      child.execFileSync = () => undefined;

      const https = require("node:https");
      const { EventEmitter } = require("node:events");
      https.get = (_url, cb) => {
        const req = new EventEmitter();
        req.setTimeout = () => req;
        req.destroy = () => undefined;
        const res = new EventEmitter();
        res.statusCode = 200;
        res.resume = () => undefined;
        cb(res);
        process.nextTick(() => {
          res.emit("data", Buffer.from(JSON.stringify({ version: process.env.TEST_LATEST_VERSION }), "utf8"));
          res.emit("end");
        });
        return req;
      };

      await import(pathToFileURL(process.env.CLI_PATH).href);
    `.trim();

    const out = execFileSync(
      NODE,
      ["--input-type=module", "-e", script, "__cli__", "lint", "-m", "feat: ok"],
      {
        encoding: "utf8",
        cwd: tmp,
        env: { ...process.env, CLI_PATH: CLI, TEST_ANSWER: "y", TEST_LATEST_VERSION: "999.0.0;bad" },
      }
    );
    assert.match(out, /Update failed/);
    assert.match(out, /Valid commit/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("install-hooks interactive: declining git init cancels without error", () => {
  const tmp = join(process.cwd(), "tmp-cli-install-hooks-interactive-cancel");
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "t" }, null, 2) + "\n", "utf8");
    writeFileSync(
      join(tmp, "commitzero.config.json"),
      JSON.stringify({ versionCheckEnabled: false, language: "en" }, null, 2),
      "utf8"
    );
    const script = `
      import { createRequire } from "node:module";
      import { pathToFileURL } from "node:url";
      const require = createRequire(import.meta.url);

      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });

      const readline = require("node:readline");
      readline.createInterface = () => ({
        question: (_prompt, cb) => cb(process.env.TEST_ANSWER || "n"),
        close: () => undefined,
      });

      await import(pathToFileURL(process.env.CLI_PATH).href);
    `.trim();

    const out = execFileSync(
      NODE,
      ["--input-type=module", "-e", script, "__cli__", "install-hooks"],
      { encoding: "utf8", cwd: tmp, env: { ...process.env, CLI_PATH: CLI, TEST_ANSWER: "n" } }
    );
    assert.match(out, /Git initialization cancelled/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

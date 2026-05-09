import assert from "node:assert";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";
import { c } from "../../dist/esm/cli/colors.js";
import { updateScripts } from "../../dist/esm/hooks/postinstall.js";
import { DEFAULT_LANG, t } from "../../dist/esm/i18n/index.js";
import { resolveGitBin, resolveNpmBin } from "../../dist/esm/utils/binaries.js";
import { formatBytes, parseSizeToBytes } from "../../dist/esm/utils/size.js";
import { formatDurationMs, parseTimeToMs } from "../../dist/esm/utils/time.js";

function withEnvVar(name: string, value: string | undefined, fn: () => void) {
  const prev = process.env[name];
  if (value === undefined) delete (process.env as any)[name];
  else process.env[name] = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete (process.env as any)[name];
    else process.env[name] = prev;
  }
}

function withTTY(isTTY: boolean, fn: () => void) {
  const stdoutDesc = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  const stderrDesc = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
  Object.defineProperty(process.stdout, "isTTY", { value: isTTY, configurable: true });
  Object.defineProperty(process.stderr, "isTTY", { value: isTTY, configurable: true });
  try {
    fn();
  } finally {
    if (stdoutDesc) Object.defineProperty(process.stdout, "isTTY", stdoutDesc);
    else delete (process.stdout as any).isTTY;
    if (stderrDesc) Object.defineProperty(process.stderr, "isTTY", stderrDesc);
    else delete (process.stderr as any).isTTY;
  }
}

test("parseSizeToBytes covers units, fallback and defaults", () => {
  assert.strictEqual(parseSizeToBytes(123), 123);
  assert.strictEqual(parseSizeToBytes("", 99), 99);
  assert.strictEqual(parseSizeToBytes("  1kb  "), 1024);
  assert.strictEqual(parseSizeToBytes("1.5MB"), 1.5 * 1024 * 1024);
  assert.strictEqual(parseSizeToBytes("2G"), 2 * 1024 * 1024 * 1024);
  assert.strictEqual(parseSizeToBytes("10B"), 10);
  assert.strictEqual(parseSizeToBytes("10"), 10);
  assert.strictEqual(parseSizeToBytes("10XB"), 10);
  assert.strictEqual(parseSizeToBytes("10 MB"), 10);
  assert.strictEqual(parseSizeToBytes("abc", 77), 77);
});

test("formatBytes covers small and larger values", () => {
  assert.strictEqual(formatBytes(0), "0B");
  assert.strictEqual(formatBytes(1024), "1KB");
  assert.strictEqual(formatBytes(1536), "1.5KB");
});

test("parseTimeToMs covers numeric, units and fallbacks", () => {
  assert.strictEqual(parseTimeToMs(undefined, 10), 10);
  assert.strictEqual(parseTimeToMs(null as any, 10), 10);
  assert.strictEqual(parseTimeToMs(1234.9), 1234);
  assert.strictEqual(parseTimeToMs(-5), 0);
  assert.strictEqual(parseTimeToMs("500"), 500);
  assert.strictEqual(parseTimeToMs("1.5s"), 1500);
  assert.strictEqual(parseTimeToMs("2m"), 120000);
  assert.strictEqual(parseTimeToMs("bad", 42), 42);
});

test("formatDurationMs covers invalid, ms, seconds and minutes", () => {
  assert.strictEqual(formatDurationMs(Number.NaN), "NaNms");
  assert.strictEqual(formatDurationMs(-1), "-1ms");
  assert.strictEqual(formatDurationMs(500), "500ms");
  assert.strictEqual(formatDurationMs(1500), "2s");
  assert.strictEqual(formatDurationMs(65000), "1m");
});

test("resolveGitBin respects COMMITZERO_GIT_BIN when it is a valid executable path", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-bin-git-"));
  try {
    const bin = join(tmp, "git");
    writeFileSync(bin, "#!/usr/bin/env bash\necho ok\n", "utf8");
    chmodSync(bin, 0o755);
    withEnvVar("COMMITZERO_GIT_BIN", `  ${bin}  `, () => {
      assert.strictEqual(resolveGitBin(), bin);
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolveGitBin ignores COMMITZERO_GIT_BIN when it is not executable", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-bin-git-noexec-"));
  try {
    const bin = join(tmp, "git");
    writeFileSync(bin, "#!/usr/bin/env bash\necho ok\n", "utf8");
    chmodSync(bin, 0o644);
    withEnvVar("COMMITZERO_GIT_BIN", bin, () => {
      const resolved = resolveGitBin();
      assert.ok(resolved);
      assert.notStrictEqual(resolved, bin);
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolveNpmBin respects COMMITZERO_NPM_BIN when it is a valid executable path", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-bin-npm-"));
  try {
    const bin = join(tmp, "npm");
    writeFileSync(bin, "#!/usr/bin/env bash\necho ok\n", "utf8");
    chmodSync(bin, 0o755);
    withEnvVar("COMMITZERO_NPM_BIN", bin, () => {
      assert.strictEqual(resolveNpmBin(), bin);
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolveGitBin and resolveNpmBin ignore invalid env values", () => {
  withEnvVar("COMMITZERO_GIT_BIN", "   ", () => {
    assert.ok(resolveGitBin());
  });
  withEnvVar("COMMITZERO_GIT_BIN", "git", () => {
    assert.ok(resolveGitBin());
  });
  withEnvVar("COMMITZERO_GIT_BIN", "/tmp/commitzero-missing-git-bin", () => {
    assert.ok(resolveGitBin());
  });

  withEnvVar("COMMITZERO_NPM_BIN", "   ", () => {
    assert.ok(resolveNpmBin());
  });
  withEnvVar("COMMITZERO_NPM_BIN", "npm", () => {
    assert.ok(resolveNpmBin());
  });
  withEnvVar("COMMITZERO_NPM_BIN", "/tmp/commitzero-missing-npm-bin", () => {
    assert.ok(resolveNpmBin());
  });
});

test("t() falls back to default language and key when missing", () => {
  assert.strictEqual(DEFAULT_LANG, "en");
  assert.strictEqual(t("xx" as any, "cli.valid"), "Valid commit");
  assert.strictEqual(t("en", "missing.key"), "missing.key");
  assert.strictEqual(t("en", "cli.warning", { msg: "oops" }), "Warning: oops");
  assert.strictEqual(t("en", "cli.warning", {}), "Warning: ");
});

test("colors respect NO_COLOR, FORCE_COLOR and TTY", () => {
  withTTY(false, () => {
    withEnvVar("NO_COLOR", undefined, () => {
      withEnvVar("FORCE_COLOR", undefined, () => {
        assert.strictEqual(c.red("x"), "x");
      });
    });
  });

  withTTY(false, () => {
    withEnvVar("FORCE_COLOR", "1", () => {
      assert.match(c.red("x"), /\u001b\[31mx\u001b\[0m/);
    });
  });

  withTTY(true, () => {
    withEnvVar("NO_COLOR", "1", () => {
      withEnvVar("FORCE_COLOR", undefined, () => {
        assert.strictEqual(c.red("x"), "x");
      });
    });
  });
});

test("updateScripts adds scripts based on detected package manager", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-postinstall-"));
  try {
    const pkgPath = join(tmp, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ name: "consumer" }, null, 2) + "\n", "utf8");
    writeFileSync(join(tmp, "pnpm-lock.yaml"), "lockfileVersion: 6\n", "utf8");

    updateScripts(tmp);

    const updated = JSON.parse(readFileSync(pkgPath, "utf8"));
    assert.strictEqual(updated.scripts.committzero, undefined);
    assert.strictEqual(updated.scripts["commitzero"], "commitzero");
    assert.strictEqual(updated.scripts["commitzero:install"], "pnpm exec commitzero install-hooks");
    assert.strictEqual(
      updated.scripts["commitzero:uninstall"],
      "pnpm exec commitzero uninstall-hooks"
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("updateScripts does not override existing scripts and ignores invalid package.json", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-postinstall-nooverride-"));
  try {
    const pkgPath = join(tmp, "package.json");
    writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: "consumer",
          scripts: {
            commitzero: "custom",
            "commitzero:install": "custom install",
            "commitzero:uninstall": "custom uninstall",
          },
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    writeFileSync(join(tmp, "yarn.lock"), "yarn lockfile\n", "utf8");
    updateScripts(tmp);
    const updated = JSON.parse(readFileSync(pkgPath, "utf8"));
    assert.strictEqual(updated.scripts.committzero, undefined);
    assert.strictEqual(updated.scripts["commitzero"], "custom");
    assert.strictEqual(updated.scripts["commitzero:install"], "custom install");
    assert.strictEqual(updated.scripts["commitzero:uninstall"], "custom uninstall");

    const invalidDir = mkdtempSync(join(os.tmpdir(), "commitzero-postinstall-invalid-"));
    try {
      const invalidPkg = join(invalidDir, "package.json");
      writeFileSync(invalidPkg, "{ invalid json", "utf8");
      updateScripts(invalidDir);
      assert.strictEqual(readFileSync(invalidPkg, "utf8"), "{ invalid json");
    } finally {
      rmSync(invalidDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("updateScripts does not modify CommitZero's own package.json", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-postinstall-self-"));
  try {
    const pkgPath = join(tmp, "package.json");
    const original = JSON.stringify({ name: "@codemastersolutions/commitzero" }, null, 2) + "\n";
    writeFileSync(pkgPath, original, "utf8");
    updateScripts(tmp);
    assert.strictEqual(readFileSync(pkgPath, "utf8"), original);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("version check module covers fetchLatestVersion and checkForUpdate branches", async () => {
  const requireForTest = createRequire(import.meta.url);
  const https = requireForTest("node:https");
  const { EventEmitter } = requireForTest("node:events");
  const { mkdirSync } = requireForTest("node:fs");

  const originalGet = https.get;
  const originalNow = Date.now;
  try {
    let impl: any = () => {
      throw new Error("unconfigured https.get stub");
    };
    https.get = (url: string, cb: (res: any) => void) => impl(url, cb);

    const { fetchLatestVersion, checkForUpdate } = await import("../../dist/esm/version/check.js");

    impl = (_url: string, cb: (res: any) => void) => {
      const req = new EventEmitter();
      req.setTimeout = () => req;
      req.destroy = () => undefined;
      const res = new EventEmitter();
      res.statusCode = 404;
      res.resume = () => undefined;
      cb(res);
      return req;
    };
    assert.strictEqual(await fetchLatestVersion("@codemastersolutions/commitzero"), null);

    {
      let call = 0;
      impl = (_url: string, cb: (res: any) => void) => {
        call += 1;
        const req = new EventEmitter();
        req.setTimeout = () => req;
        req.destroy = () => undefined;
        const res = new EventEmitter();
        res.statusCode = 200;
        res.resume = () => undefined;
        cb(res);
        process.nextTick(() => {
          if (call === 1) {
            res.emit("data", Buffer.from("{", "utf8"));
            res.emit("end");
            return;
          }
          res.emit("data", Buffer.from(JSON.stringify({ name: "x" }), "utf8"));
          res.emit("end");
        });
        return req;
      };
      assert.strictEqual(await fetchLatestVersion("x"), null);
      assert.strictEqual(await fetchLatestVersion("x"), null);
    }

    {
      let call = 0;
      impl = (_url: string) => {
        call += 1;
        const req = new EventEmitter();
        req.destroy = () => undefined;
        req.setTimeout = (_ms: number, cb: () => void) => {
          if (call === 2) process.nextTick(cb);
          return req;
        };
        if (call === 1) process.nextTick(() => req.emit("error", new Error("boom")));
        return req;
      };
      assert.strictEqual(await fetchLatestVersion("x"), null);
      assert.strictEqual(await fetchLatestVersion("x"), null);
    }

    Date.now = () => 1_000_000;
    let responseBody: any = { version: "1.2.3" };
    impl = (_url: string, cb: (res: any) => void) => {
      const req = new EventEmitter();
      req.setTimeout = () => req;
      req.destroy = () => undefined;
      const res = new EventEmitter();
      res.statusCode = 200;
      res.resume = () => undefined;
      cb(res);
      process.nextTick(() => {
        res.emit("data", Buffer.from(JSON.stringify(responseBody), "utf8"));
        res.emit("end");
      });
      return req;
    };
    {
      const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-versioncheck-"));
      try {
        const cwdFile = join(tmp, "not-a-dir");
        writeFileSync(cwdFile, "x", "utf8");
        assert.deepStrictEqual(
          await checkForUpdate({
            enabled: true,
            period: "weekly",
            cwd: cwdFile,
            packageName: "@codemastersolutions/commitzero",
            currentVersion: "1.2.3",
          }),
          { shouldPrompt: false }
        );
        assert.deepStrictEqual(
          await checkForUpdate({
            enabled: true,
            period: "monthly",
            cwd: cwdFile,
            packageName: "@codemastersolutions/commitzero",
            currentVersion: "2.0.0",
          }),
          { shouldPrompt: false }
        );
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    }

    Date.now = () => 10_000;
    {
      const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-versioncheck-state-"));
      try {
        const stateDir = join(tmp, ".commitzero");
        const stateFile = join(stateDir, "version-check.json");
        mkdirSync(stateDir, { recursive: true });
        writeFileSync(
          stateFile,
          JSON.stringify({ lastCheckedAt: 9_999, lastPromptedVersion: "9.9.9" }, null, 2),
          "utf8"
        );

        let called = 0;
        impl = () => {
          called += 1;
          throw new Error("should not fetch");
        };
        assert.deepStrictEqual(
          await checkForUpdate({
            enabled: true,
            period: "daily",
            cwd: tmp,
            packageName: "@codemastersolutions/commitzero",
            currentVersion: "0.0.1",
          }),
          { shouldPrompt: false }
        );
        assert.strictEqual(called, 0);

        impl = (_url: string) => {
          const req = new EventEmitter();
          req.setTimeout = () => req;
          req.destroy = () => undefined;
          process.nextTick(() => req.emit("error", new Error("boom")));
          return req;
        };
        Date.now = () => 10_000 + 2 * 24 * 60 * 60 * 1000;
        assert.deepStrictEqual(
          await checkForUpdate({
            enabled: true,
            period: "daily",
            cwd: tmp,
            packageName: "@codemastersolutions/commitzero",
            currentVersion: "0.0.1",
          }),
          { shouldPrompt: false }
        );

        const updated = JSON.parse(readFileSync(stateFile, "utf8"));
        assert.strictEqual(updated.lastPromptedVersion, "9.9.9");
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    }

    Date.now = () => 1_000_000;
    {
      const tmpRecent = mkdtempSync(join(os.tmpdir(), "commitzero-versioncheck-recent-"));
      try {
        const stateDir = join(tmpRecent, ".commitzero");
        const stateFile = join(stateDir, "version-check.json");
        mkdirSync(stateDir, { recursive: true });
        writeFileSync(stateFile, JSON.stringify({ lastCheckedAt: Date.now() }, null, 2), "utf8");

        impl = () => {
          throw new Error("should not fetch");
        };
        assert.deepStrictEqual(
          await checkForUpdate({
            enabled: true,
            period: "daily",
            cwd: tmpRecent,
            packageName: "@codemastersolutions/commitzero",
            currentVersion: "0.0.1",
          }),
          { shouldPrompt: false }
        );
      } finally {
        rmSync(tmpRecent, { recursive: true, force: true });
      }
    }

    impl = (_url: string, cb: (res: any) => void) => {
      const req = new EventEmitter();
      req.setTimeout = () => req;
      req.destroy = () => undefined;
      const res = new EventEmitter();
      res.statusCode = 200;
      res.resume = () => undefined;
      cb(res);
      process.nextTick(() => {
        res.emit("data", Buffer.from(JSON.stringify(responseBody), "utf8"));
        res.emit("end");
      });
      return req;
    };

    {
      const tmpWeekly = mkdtempSync(join(os.tmpdir(), "commitzero-versioncheck-weekly-"));
      try {
        const stateDir = join(tmpWeekly, ".commitzero");
        const stateFile = join(stateDir, "version-check.json");
        mkdirSync(stateDir, { recursive: true });
        writeFileSync(
          stateFile,
          JSON.stringify({ lastCheckedAt: Date.now() - 7 * 24 * 60 * 60 * 1000 - 1 }, null, 2),
          "utf8"
        );

        responseBody = { version: "2.0.0" };
        assert.deepStrictEqual(
          await checkForUpdate({
            enabled: true,
            period: "weekly",
            cwd: tmpWeekly,
            packageName: "@codemastersolutions/commitzero",
            currentVersion: "1.9.9",
          }),
          { shouldPrompt: true, latestVersion: "2.0.0" }
        );
      } finally {
        rmSync(tmpWeekly, { recursive: true, force: true });
      }
    }

    {
      const tmpMonthly = mkdtempSync(join(os.tmpdir(), "commitzero-versioncheck-monthly-"));
      try {
        const stateDir = join(tmpMonthly, ".commitzero");
        const stateFile = join(stateDir, "version-check.json");
        mkdirSync(stateDir, { recursive: true });
        writeFileSync(
          stateFile,
          JSON.stringify({ lastCheckedAt: Date.now() - 30 * 24 * 60 * 60 * 1000 - 1 }, null, 2),
          "utf8"
        );

        responseBody = { version: "1.2.0" };
        assert.deepStrictEqual(
          await checkForUpdate({
            enabled: true,
            period: "monthly",
            cwd: tmpMonthly,
            packageName: "@codemastersolutions/commitzero",
            currentVersion: "1.1.9",
          }),
          { shouldPrompt: true, latestVersion: "1.2.0" }
        );
      } finally {
        rmSync(tmpMonthly, { recursive: true, force: true });
      }
    }

    {
      const run = async (body: any, currentVersion: string, expected: any) => {
        const tmpSemver = mkdtempSync(join(os.tmpdir(), "commitzero-versioncheck-semver-"));
        try {
          responseBody = body;
          assert.deepStrictEqual(
            await checkForUpdate({
              enabled: true,
              period: "daily",
              cwd: tmpSemver,
              packageName: "@codemastersolutions/commitzero",
              currentVersion,
            }),
            expected
          );
        } finally {
          rmSync(tmpSemver, { recursive: true, force: true });
        }
      };

      await run({ version: "1.1.2" }, "1.1.1", { shouldPrompt: true, latestVersion: "1.1.2" });
      await run({ version: "1.1.1" }, "1.2.0", { shouldPrompt: false });
      await run({ version: "v1.0.0" }, "1.0.0", { shouldPrompt: true, latestVersion: "v1.0.0" });
      await run({ version: 123 }, "1.0.0", { shouldPrompt: false });
    }
  } finally {
    https.get = originalGet;
    Date.now = originalNow;
  }
});

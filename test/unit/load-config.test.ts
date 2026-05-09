import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "../../dist/esm/config/load.js";

test("loadConfig loads commitzero.config.json when present", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-config-json-"));
  try {
    writeFileSync(
      join(tmp, "commitzero.config.json"),
      JSON.stringify({ requireScope: true, maxSubjectLength: 10, language: "en" }, null, 2),
      "utf8"
    );
    const cfg = loadConfig(tmp) as any;
    assert.strictEqual(cfg.requireScope, true);
    assert.strictEqual(cfg.maxSubjectLength, 10);
    assert.strictEqual(cfg.language, "en");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("loadConfig merges commitzero.config.custom.json over base config", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-config-custom-"));
  try {
    writeFileSync(
      join(tmp, "commitzero.config.json"),
      JSON.stringify({ language: "en" }, null, 2),
      "utf8"
    );
    writeFileSync(
      join(tmp, "commitzero.config.custom.json"),
      JSON.stringify({ language: "pt", requireScope: true }, null, 2),
      "utf8"
    );
    const cfg = loadConfig(tmp) as any;
    assert.strictEqual(cfg.language, "pt");
    assert.strictEqual(cfg.requireScope, true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("loadConfig does not crash when only JS config files exist", () => {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-config-js-"));
  const requireForTest = createRequire(import.meta.url);
  const prevGlobalRequire = (globalThis as any).require;
  try {
    (globalThis as any).require = requireForTest;

    const jsConfigPath = join(tmp, "commitzero.config.js");
    const customJsConfigPath = join(tmp, "commitzero.config.custom.js");
    const clearRequireCache = (path: string) => {
      try {
        delete (requireForTest as any).cache[requireForTest.resolve(path)];
      } catch {}
    };

    writeFileSync(jsConfigPath, "module.exports = { language: 'en' };\n", "utf8");
    clearRequireCache(jsConfigPath);
    const cfg1 = loadConfig(tmp) as any;
    assert.strictEqual(cfg1.language, "en");

    writeFileSync(jsConfigPath, "module.exports = 'not-an-object';\n", "utf8");
    clearRequireCache(jsConfigPath);
    const cfgNonObj = loadConfig(tmp) as any;
    assert.deepStrictEqual(cfgNonObj, {});

    writeFileSync(jsConfigPath, "throw new Error('boom');\n", "utf8");
    clearRequireCache(jsConfigPath);
    const cfgThrow = loadConfig(tmp) as any;
    assert.deepStrictEqual(cfgThrow, {});

    writeFileSync(
      join(tmp, "commitzero.config.json"),
      JSON.stringify({ language: "en", requireScope: false }, null, 2),
      "utf8"
    );
    writeFileSync(customJsConfigPath, "module.exports = { requireScope: true };\n", "utf8");
    clearRequireCache(customJsConfigPath);
    const cfg2 = loadConfig(tmp) as any;
    assert.strictEqual(cfg2.language, "en");
    assert.strictEqual(cfg2.requireScope, true);
  } finally {
    if (prevGlobalRequire === undefined) delete (globalThis as any).require;
    else (globalThis as any).require = prevGlobalRequire;
    rmSync(tmp, { recursive: true, force: true });
  }
});

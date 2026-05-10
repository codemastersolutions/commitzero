import assert from "node:assert";
import test from "node:test";
import { t } from "../../dist/esm/i18n/index.js";
import type { Lang } from "../../dist/esm/i18n/index.js";

test("t returns the translated string for a known key", () => {
  assert.strictEqual(t("en", "cli.valid"), "Valid commit");
  assert.strictEqual(t("pt", "cli.valid"), "Commit válido");
});

test("t returns the key itself when translation is missing", () => {
  assert.strictEqual(t("en", "missing.key"), "missing.key");
});

test("t keeps placeholders when params are not provided", () => {
  assert.strictEqual(t("en", "cli.warning"), "Warning: {msg}");
});

test("t replaces placeholders with provided params (string and number)", () => {
  assert.strictEqual(
    t("en", "cli.fileSizeLimitExceeded", { limit: 10, file: "a.txt", size: 123 }),
    "File size limit exceeded (10): a.txt (123)"
  );
});

test("t replaces missing params with empty string", () => {
  assert.strictEqual(t("en", "cli.warning", {}), "Warning: ");
});

test("t falls back to DEFAULT_LANG when lang is not in dictionaries", () => {
  const invalidLang = "xx" as unknown as Lang;
  assert.strictEqual(t(invalidLang, "cli.valid"), "Valid commit");
});

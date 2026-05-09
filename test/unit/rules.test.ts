import test from "node:test";
import assert from "node:assert";
import { lintCommit, defaultOptions } from "../../dist/esm/core/rules.js";

test("valid conventional commit", () => {
  const res = lintCommit({ type: "feat", subject: "add x" }, defaultOptions);
  assert.equal(res.valid, true);
});

test("invalid type", () => {
  const res = lintCommit({ type: "foo", subject: "x" }, defaultOptions);
  assert.equal(res.valid, false);
});

test("require blank line between header and body", () => {
  const res = lintCommit(
    {
      type: "feat",
      subject: "add x",
      body: "details",
      meta: { header: "feat: add x", hasBlankAfterHeader: false, hasBlankBeforeFooter: false },
    },
    defaultOptions
  );
  assert.equal(res.valid, false);
});

test("breaking change requires footer", () => {
  const res = lintCommit({ type: "feat", subject: "add x!", isBreaking: true }, defaultOptions);
  assert.equal(res.valid, false);
});

test("scope rules cover requireScope, allowed scopes, pattern and lowercase", () => {
  {
    const res = lintCommit(
      { type: "feat", subject: "add x" },
      { ...defaultOptions, requireScope: true }
    );
    assert.equal(res.valid, false);
    assert.ok(res.errors.length > 0);
  }

  {
    const res = lintCommit(
      { type: "feat", scope: "core", subject: "add x" },
      { ...defaultOptions, scopes: ["api"] }
    );
    assert.equal(res.valid, false);
  }

  {
    const res = lintCommit(
      { type: "feat", scope: "bad@", subject: "add x" },
      { ...defaultOptions, scopes: ["bad@"] }
    );
    assert.equal(res.valid, false);
  }

  {
    const res = lintCommit(
      { type: "feat", scope: "Core", subject: "add x" },
      { ...defaultOptions, scopes: ["Core"] }
    );
    assert.equal(res.valid, false);
  }
});

test("type rules cover lowercase enforcement", () => {
  const res = lintCommit({ type: "FEAT", subject: "add x" }, defaultOptions);
  assert.equal(res.valid, false);
});

test("subject, footer and breaking options cover warnings and errors", () => {
  const tooLong = "a".repeat(defaultOptions.maxSubjectLength + 1);
  const res1 = lintCommit({ type: "feat", subject: tooLong }, defaultOptions);
  assert.equal(res1.valid, true);
  assert.ok(res1.warnings.length > 0);

  const res2 = lintCommit(
    {
      type: "feat",
      subject: "add x",
      footers: [{ key: "Unknown", value: "1" }],
      meta: { header: "feat: add x", hasBlankAfterHeader: true, hasBlankBeforeFooter: true },
    },
    defaultOptions
  );
  assert.equal(res2.valid, true);
  assert.ok(res2.warnings.length > 0);

  const res3 = lintCommit(
    { type: "feat", subject: "add x!", isBreaking: true },
    { ...defaultOptions, allowBreaking: false }
  );
  assert.equal(res3.valid, false);
});

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
  const res = lintCommit({ type: "feat", subject: "add x", body: "details", meta: { header: "feat: add x", hasBlankAfterHeader: false, hasBlankBeforeFooter: false } }, defaultOptions);
  assert.equal(res.valid, false);
});

test("breaking change requires footer", () => {
  const res = lintCommit({ type: "feat", subject: "add x!", isBreaking: true }, defaultOptions);
  assert.equal(res.valid, false);
});
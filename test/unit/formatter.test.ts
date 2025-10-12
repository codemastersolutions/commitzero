import assert from "node:assert";
import test from "node:test";
import { formatMessage } from "../../dist/esm/core/formatter.js";
import type { ParsedCommit } from "../../dist/esm/core/rules.js";

test("formatMessage with type, scope and breaking", () => {
  const commit: ParsedCommit = {
    type: "feat",
    scope: "api",
    isBreaking: true,
    subject: "add endpoint",
  };
  const msg = formatMessage(commit);
  assert.strictEqual(msg, "feat(api)!: add endpoint");
});

test("formatMessage without scope or breaking", () => {
  const commit: ParsedCommit = {
    type: "fix",
    subject: "correct typo",
  };
  const msg = formatMessage(commit);
  assert.strictEqual(msg, "fix: correct typo");
});

test("formatMessage with body lines", () => {
  const commit: ParsedCommit = {
    type: "chore",
    subject: "update deps",
    body: "line one\nline two",
  };
  const msg = formatMessage(commit);
  assert.strictEqual(msg, "chore: update deps\n\nline one\nline two");
});

test("formatMessage with footers", () => {
  const commit: ParsedCommit = {
    type: "refactor",
    scope: "ui",
    subject: "simplify component",
    footers: [
      { key: "BREAKING CHANGE", value: "new api" },
      { key: "Refs", value: "#123" },
    ],
  };
  const msg = formatMessage(commit);
  assert.strictEqual(
    msg,
    "refactor(ui): simplify component\n\nBREAKING CHANGE: new api\nRefs: #123"
  );
});
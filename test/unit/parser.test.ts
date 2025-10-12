import test from "node:test";
import assert from "node:assert";
import { parseMessage } from "../../dist/esm/core/parser.js";

test("parse header with type, scope and subject", () => {
  const m = parseMessage("feat(core): add feature\n\nBody\n\nBREAKING CHANGE: api");
  assert.strictEqual(m.type, "feat");
  assert.strictEqual(m.scope, "core");
  assert.strictEqual(m.subject, "add feature");
  assert.strictEqual(m.body, "Body");
  assert.ok(m.isBreaking);
  assert.ok(m.meta?.hasBlankAfterHeader);
  assert.ok(m.meta?.hasBlankBeforeFooter);
});

test("parse without blank lines", () => {
  const m = parseMessage("fix: bug\nBody\nRefs: 123");
  assert.equal(m.meta?.hasBlankAfterHeader, false);
  assert.ok(!m.meta?.hasBlankBeforeFooter);
});

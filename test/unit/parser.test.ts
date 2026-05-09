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

test("parse header only keeps body undefined and footers empty", () => {
  const m = parseMessage("feat: ok");
  assert.strictEqual(m.type, "feat");
  assert.strictEqual(m.scope, undefined);
  assert.strictEqual(m.subject, "ok");
  assert.strictEqual(m.body, undefined);
  assert.deepStrictEqual(m.footers, []);
  assert.strictEqual(m.isBreaking, false);
  assert.strictEqual(m.meta?.hasBlankAfterHeader, false);
  assert.strictEqual(m.meta?.hasBlankBeforeFooter, false);
});

test("parse breaking change via bang", () => {
  const m = parseMessage("feat!: breaking");
  assert.strictEqual(m.type, "feat");
  assert.strictEqual(m.isBreaking, true);
});

test("parse footer without blank line before footer", () => {
  const m = parseMessage("feat: ok\n\nBody\nRefs: 1");
  assert.strictEqual(m.body, "Body");
  assert.strictEqual(m.footers?.length, 1);
  assert.strictEqual(m.meta?.hasBlankBeforeFooter, false);
});

test("parse footer immediately after header does not count as having blank before footer", () => {
  const m = parseMessage("feat: ok\nRefs: 1");
  assert.strictEqual(m.body, undefined);
  assert.strictEqual(m.footers?.length, 1);
  assert.strictEqual(m.meta?.hasBlankBeforeFooter, false);
});

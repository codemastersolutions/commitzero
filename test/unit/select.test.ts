import assert from "node:assert";
import test from "node:test";
import { select } from "../../dist/cjs/cli/commands/select.js";

test("select resolves first item value when not TTY", async () => {
  // Simulate non-TTY by temporarily patching process.stdin.isTTY
  const orig = process.stdin.isTTY;
  // @ts-ignore
  process.stdin.isTTY = false;
  try {
    const res = await select(
      "Choose:",
      [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ]
    );
    assert.strictEqual(res, "a");
  } finally {
    // @ts-ignore
    process.stdin.isTTY = orig;
  }
});

test("select resolves undefined on empty items when not TTY", async () => {
  const orig = process.stdin.isTTY;
  // @ts-ignore
  process.stdin.isTTY = false;
  try {
    const res = await select("Choose:", []);
    assert.strictEqual(res, undefined);
  } finally {
    // @ts-ignore
    process.stdin.isTTY = orig;
  }
});

test("select TTY: arrow down then Enter selects second item", async () => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & { push?: (chunk: any) => boolean };
  const origTTY = stdin.isTTY;
  const origSetRaw = stdin.setRawMode;
  // @ts-ignore
  stdin.isTTY = true;
  // Stub setRawMode to avoid actual terminal changes
  // @ts-ignore
  stdin.setRawMode = () => {};
  try {
    const p = select(
      "Choose:",
      [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ]
    );
    // Arrow Down
    stdin.emit("data", Buffer.from("\x1b[B", "utf8"));
    // Enter
    stdin.emit("data", Buffer.from("\r", "utf8"));
    const res = await p;
    assert.strictEqual(res, "b");
  } finally {
    // @ts-ignore
    stdin.isTTY = origTTY;
    // @ts-ignore
    stdin.setRawMode = origSetRaw;
  }
});

test("select TTY: j and k navigation wraps around", async () => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & { push?: (chunk: any) => boolean };
  const origTTY = stdin.isTTY;
  const origSetRaw = stdin.setRawMode;
  // @ts-ignore
  stdin.isTTY = true;
  // @ts-ignore
  stdin.setRawMode = () => {};
  try {
    const p = select(
      "Choose:",
      [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
        { label: "C", value: "c" },
      ]
    );
    // Move up from first using 'k' should wrap to last
    stdin.emit("data", Buffer.from("k", "utf8"));
    // Enter
    stdin.emit("data", Buffer.from("\r", "utf8"));
    const res1 = await p;
    assert.strictEqual(res1, "c");
  } finally {
    // @ts-ignore
    stdin.isTTY = origTTY;
    // @ts-ignore
    stdin.setRawMode = origSetRaw;
  }
});

test("select TTY: Ctrl+C cancels", async () => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & { push?: (chunk: any) => boolean };
  const origTTY = stdin.isTTY;
  const origSetRaw = stdin.setRawMode;
  // @ts-ignore
  stdin.isTTY = true;
  // @ts-ignore
  stdin.setRawMode = () => {};
  try {
    const p = select(
      "Choose:",
      [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ]
    );
    // Ctrl+C
    stdin.emit("data", Buffer.from("\x03", "utf8"));
    await assert.rejects(p, /cancelled/);
  } finally {
    // @ts-ignore
    stdin.isTTY = origTTY;
    // @ts-ignore
    stdin.setRawMode = origSetRaw;
  }
});

test("select TTY: header does not throw and Enter selects first", async () => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & { push?: (chunk: any) => boolean };
  const origTTYIn = stdin.isTTY;
  const origSetRaw = stdin.setRawMode;
  // @ts-ignore
  stdin.isTTY = true;
  // @ts-ignore
  stdin.setRawMode = () => {};
  try {
    const p = select(
      "Choose:",
      [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
      "Header"
    );
    stdin.emit("data", Buffer.from("\r", "utf8"));
    const res = await p;
    assert.strictEqual(res, "a");
  } finally {
    // @ts-ignore
    stdin.isTTY = origTTYIn;
    // @ts-ignore
    stdin.setRawMode = origSetRaw;
  }
});
import assert from "node:assert";
import test from "node:test";
import { select } from "../../dist/cjs/cli/commands/select.js";

test("select resolves first item value when not TTY", async () => {
  const orig = process.stdin.isTTY;
  process.stdin.isTTY = false;
  try {
    const res = await select("Choose:", [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ]);
    assert.strictEqual(res, "a");
  } finally {
    process.stdin.isTTY = orig;
  }
});

test("select resolves undefined on empty items when not TTY", async () => {
  const orig = process.stdin.isTTY;
  process.stdin.isTTY = false;
  try {
    const res = await select("Choose:", []);
    assert.strictEqual(res, undefined);
  } finally {
    process.stdin.isTTY = orig;
  }
});

test("select TTY: arrow down then Enter selects second item", async () => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & {
    push?: (chunk: any) => boolean;
  };
  const origTTY = stdin.isTTY;
  const origSetRaw = stdin.setRawMode;
  stdin.isTTY = true;
  stdin.setRawMode = () => stdin;
  try {
    const p = select("Choose:", [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ]);
    stdin.emit("data", Buffer.from("\x1b[B", "utf8"));
    stdin.emit("data", Buffer.from("\r", "utf8"));
    const res = await p;
    assert.strictEqual(res, "b");
  } finally {
    stdin.isTTY = origTTY;
    stdin.setRawMode = origSetRaw;
  }
});

test("select TTY: j and k navigation wraps around", async () => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & {
    push?: (chunk: any) => boolean;
  };
  const origTTY = stdin.isTTY;
  const origSetRaw = stdin.setRawMode;
  stdin.isTTY = true;
  stdin.setRawMode = () => stdin;
  try {
    const p = select("Choose:", [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
      { label: "C", value: "c" },
    ]);
    stdin.emit("data", Buffer.from("k", "utf8"));
    stdin.emit("data", Buffer.from("\r", "utf8"));
    const res1 = await p;
    assert.strictEqual(res1, "c");
  } finally {
    stdin.isTTY = origTTY;
    stdin.setRawMode = origSetRaw;
  }
});

test("select TTY: Ctrl+C cancels", async () => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & {
    push?: (chunk: any) => boolean;
  };
  const origTTY = stdin.isTTY;
  const origSetRaw = stdin.setRawMode;
  stdin.isTTY = true;
  stdin.setRawMode = () => stdin;
  try {
    const p = select("Choose:", [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ]);
    stdin.emit("data", Buffer.from("\x03", "utf8"));
    await assert.rejects(p, /cancelled/);
  } finally {
    stdin.isTTY = origTTY;
    stdin.setRawMode = origSetRaw;
  }
});

test("select TTY: header does not throw and Enter selects first", async () => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & {
    push?: (chunk: any) => boolean;
  };
  const origTTYIn = stdin.isTTY;
  const origSetRaw = stdin.setRawMode;
  stdin.isTTY = true;
  stdin.setRawMode = () => stdin;
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
    stdin.isTTY = origTTYIn;
    stdin.setRawMode = origSetRaw;
  }
});

import { c } from "../colors";

interface Item {
  value: string;
  label?: string;
  description?: string;
}

function hideCursor() {
  process.stdout.write("\x1b[?25l");
}

function showCursor() {
  process.stdout.write("\x1b[?25h");
}

function enterAltScreen() {
  process.stdout.write("\x1b[?1049h");
}

function exitAltScreen() {
  process.stdout.write("\x1b[?1049l");
}

function clearLine() {
  process.stdout.write("\x1b[2K\r");
}

function clearScreen() {
  process.stdout.write("\x1b[2J");
}

function clearDown() {
  process.stdout.write("\x1b[J");
}

function cursorHome() {
  process.stdout.write("\x1b[H");
}

function saveCursor() {
  process.stdout.write("\x1b[s");
}

function restoreCursor() {
  process.stdout.write("\x1b[u");
}

function renderPrompt(prompt: string) {
  clearLine();
  process.stdout.write(c.bold(prompt) + "\n");
}

function moveCursorUp(n: number) {
  if (n > 0) process.stdout.write(`\x1b[${n}A`);
}

function renderItems(items: Item[], selected: number, maxVisible?: number): number {
  let lines = 0;
  const maxLabelLen = Math.max(...items.map((it) => (it.label ?? it.value).length));
  const total = items.length;
  let start = 0;
  let end = total;
  if (typeof maxVisible === "number" && maxVisible > 0 && total > maxVisible) {
    const half = Math.floor(maxVisible / 2);
    start = Math.min(Math.max(selected - half, 0), total - maxVisible);
    end = start + maxVisible;
  }
  for (let i = start; i < end; i++) {
    const it = items[i];
    const pointer = i === selected ? c.cyan("❯") : " ";
    const baseLabel = `${it.label ?? it.value}`.padEnd(maxLabelLen + 1, " ");
    const label = i === selected ? c.bold(baseLabel) : baseLabel;
    const desc = it.description ? c.dim(it.description) : "";
    clearLine();
    process.stdout.write(`${pointer} ${label}${desc ? "  " + desc : ""}\n`);
    lines++;
  }
  return lines;
}

export async function select(prompt: string, items: Item[], header?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const isTTY = !!stdin.isTTY;
    // In coverage/CI runs we may want to force non-interactive behavior to avoid
    // leaving stdin listeners or raw mode on, which can keep the event loop alive.
    // Use a dedicated env guard so unit tests that simulate TTY continue to work.
    const forceNonInteractive = process.env.COMMITSKIP_SELECT_PROMPT === "1";
    if (!isTTY || forceNonInteractive) {
      try {
        stdin.pause?.();
      } catch {}
      return resolve(items[0]?.value);
    }
    let selected = 0;
    let cleaned = false;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
    const useAlt = !!stdout.isTTY && process.env.USE_ALT_SCREEN === "1";
    if (useAlt) enterAltScreen();
    hideCursor();
    if (useAlt) {
      cursorHome();
      clearScreen();
    }
    // Compute max visible items based on terminal rows to avoid scroll duplication
    const rows = typeof (stdout as any).rows === "number" ? (stdout as any).rows : 0;
    const overhead = (header ? 2 : 0) + 1; // header + blank + prompt
    const maxVisible = rows > 0 ? Math.max(1, rows - overhead) : undefined;
    let renderedLines = 0;
    if (header) {
      clearLine();
      process.stdout.write(c.green(c.bold(header)) + "\n");
      process.stdout.write("\n");
    }
    renderPrompt(prompt);
    // Anchor the cursor at the prompt line so we can clear/redraw
    saveCursor();
    renderedLines = overhead + renderItems(items, selected, maxVisible);

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      try {
        stdin.setRawMode?.(false);
      } catch {}
      try {
        stdin.off("data", onData);
      } catch {}
      try {
        stdin.pause?.();
      } catch {}
      try {
        const listeners = stdin.listeners("data");
        for (const l of listeners) {
          stdin.removeListener("data", l as (...args: unknown[]) => void);
        }
      } catch {}
      try {
        if (useAlt) exitAltScreen();
      } catch {}
      try {
        showCursor();
      } catch {}
    }

    function onData(buf: Buffer) {
      const s = buf.toString("utf8");
      if (s === "\x1b[A") {
        selected = (selected - 1 + items.length) % items.length;
        restoreCursor();
        clearDown();
        renderedLines = overhead + renderItems(items, selected, maxVisible);
        return;
      }
      if (s === "\x1b[B") {
        selected = (selected + 1) % items.length;
        restoreCursor();
        clearDown();
        renderedLines = overhead + renderItems(items, selected, maxVisible);
        return;
      }
      if (s === "\r" || s === "\n") {
        cleanup();
        return resolve(items[selected].value);
      }
      if (s === "\x03") {
        cleanup();
        return reject(new Error("cancelled"));
      }
      if (s === "j") {
        selected = (selected + 1) % items.length;
        restoreCursor();
        clearDown();
        renderedLines = overhead + renderItems(items, selected, maxVisible);
        return;
      }
      if (s === "k") {
        selected = (selected - 1 + items.length) % items.length;
        restoreCursor();
        clearDown();
        renderedLines = overhead + renderItems(items, selected, maxVisible);
        return;
      }
    }
  });
}

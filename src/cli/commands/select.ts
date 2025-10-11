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

function renderItems(items: Item[], selected: number): number {
  let lines = 0;
  const maxLabelLen = Math.max(
    ...items.map((it) => (it.label ?? it.value).length)
  );
  for (let i = 0; i < items.length; i++) {
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

export async function select(
  prompt: string,
  items: Item[],
  header?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const isTTY = !!stdin.isTTY;
    if (!isTTY) {
      return resolve(items[0]?.value);
    }
    let selected = 0;
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
    saveCursor();
    if (header) {
      clearLine();
      process.stdout.write(c.green(c.bold(header)) + "\n");
      process.stdout.write("\n");
    }
    renderPrompt(prompt);
    renderItems(items, selected);

    function cleanup() {
      stdin.setRawMode?.(false);
      stdin.off("data", onData);
      if (useAlt) exitAltScreen();
      showCursor();
    }

    function onData(buf: Buffer) {
      const s = buf.toString("utf8");
      if (s === "\x1b[A") {
        selected = (selected - 1 + items.length) % items.length;
        if (useAlt) {
          cursorHome();
          clearScreen();
          if (header) {
            clearLine();
            process.stdout.write(c.green(c.bold(header)) + "\n");
            process.stdout.write("\n");
          }
          renderPrompt(prompt);
          renderItems(items, selected);
        } else {
          restoreCursor();
          process.stdout.write("\x1b[J");
          if (header) {
            clearLine();
            process.stdout.write(c.green(c.bold(header)) + "\n");
            process.stdout.write("\n");
          }
          renderPrompt(prompt);
          renderItems(items, selected);
        }
        return;
      }
      if (s === "\x1b[B") {
        selected = (selected + 1) % items.length;
        if (useAlt) {
          cursorHome();
          clearScreen();
          if (header) {
            clearLine();
            process.stdout.write(c.green(c.bold(header)) + "\n");
            process.stdout.write("\n");
          }
          renderPrompt(prompt);
          renderItems(items, selected);
        } else {
          restoreCursor();
          process.stdout.write("\x1b[J");
          if (header) {
            clearLine();
            process.stdout.write(c.green(c.bold(header)) + "\n");
            process.stdout.write("\n");
          }
          renderPrompt(prompt);
          renderItems(items, selected);
        }
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
        if (useAlt) {
          cursorHome();
          clearScreen();
          if (header) {
            clearLine();
            process.stdout.write(c.green(c.bold(header)) + "\n");
            process.stdout.write("\n");
          }
          renderPrompt(prompt);
          renderItems(items, selected);
        } else {
          restoreCursor();
          process.stdout.write("\x1b[J");
          if (header) {
            clearLine();
            process.stdout.write(c.green(c.bold(header)) + "\n");
            process.stdout.write("\n");
          }
          renderPrompt(prompt);
          renderItems(items, selected);
        }
        return;
      }
      if (s === "k") {
        selected = (selected - 1 + items.length) % items.length;
        if (useAlt) {
          cursorHome();
          clearScreen();
          if (header) {
            clearLine();
            process.stdout.write(c.green(c.bold(header)) + "\n");
            process.stdout.write("\n");
          }
          renderPrompt(prompt);
          renderItems(items, selected);
        } else {
          restoreCursor();
          process.stdout.write("\x1b[J");
          if (header) {
            clearLine();
            process.stdout.write(c.green(c.bold(header)) + "\n");
            process.stdout.write("\n");
          }
          renderPrompt(prompt);
          renderItems(items, selected);
        }
        return;
      }
    }
  });
}

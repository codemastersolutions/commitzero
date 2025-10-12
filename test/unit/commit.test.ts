import assert from "node:assert";
import test, { mock } from "node:test";
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import * as readline from "node:readline";

function withGitStub(mode: "a" | "b" | "c", fn: () => Promise<void> | void) {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-git-"));
  const gitPath = join(tmp, "git");
  const script = `#!/usr/bin/env bash\n
mode=\"$GIT_STUB_MODE\"\n
cmd=\"$1\"\n
if [ \"$cmd\" = \"diff\" ]; then\n  if [ \"$2\" = \"--cached\" ] && [ \"$3\" = \"--name-only\" ]; then\n    if [ \"$mode\" = \"a\" ]; then\n      echo \"\"\n    elif [ \"$mode\" = \"b\" ]; then\n      echo \"\"\n    else\n      echo \"file.txt\"\n    fi\n    exit 0\n  fi\nfi\n
if [ \"$cmd\" = \"status\" ]; then\n  if [ \"$2\" = \"--porcelain\" ]; then\n    if [ \"$mode\" = \"a\" ]; then\n      echo \"\"\n    elif [ \"$mode\" = \"b\" ]; then\n      echo \" M file.txt\"\n    else\n      echo \"\"\n    fi\n    exit 0\n  fi\nfi\n
if [ \"$cmd\" = \"add\" ]; then\n  exit 0\nfi\nif [ \"$cmd\" = \"commit\" ]; then\n  exit 0\nfi\nif [ \"$cmd\" = \"push\" ]; then\n  exit 0\nfi\n
echo \"Unknown command: $@\" 1>&2\nexit 1\n`;
  writeFileSync(gitPath, script, "utf8");
  chmodSync(gitPath, 0o755);
  const prevPath = process.env.PATH || "";
  const prevMode = process.env.GIT_STUB_MODE;
  process.env.PATH = `${tmp}:${prevPath}`;
  process.env.GIT_STUB_MODE = mode;
  try {
    return fn();
  } finally {
    process.env.PATH = prevPath;
    if (prevMode === undefined) delete (process.env as any).GIT_STUB_MODE;
    else process.env.GIT_STUB_MODE = prevMode as string;
  }
}

async function loadInteractiveCommit() {
  const mod = await import("../../dist/cjs/cli/commands/commit.js");
  return mod.interactiveCommit as (lang: string, cfg?: any) => Promise<number>;
}

test("interactiveCommit aborts when no staged and no changes", async () => {
  await withGitStub("a", async () => {
    const interactiveCommit = await loadInteractiveCommit();
    const rc = await interactiveCommit("en", { autoAdd: false });
    assert.strictEqual(rc, 1);
  });
});

test("interactiveCommit autoAdd true but still no staged aborts", async () => {
  await withGitStub("b", async () => {
    const interactiveCommit = await loadInteractiveCommit();
    const rc = await interactiveCommit("en", { autoAdd: true });
    assert.strictEqual(rc, 1);
  });
});

function withReadlineStub(answers: string[], fn: () => Promise<void> | void) {
  let idx = 0;
  const restore = mock.method(readline, "createInterface", () => ({
    once: () => {},
    removeListener: () => {},
    question: (q: string, cb: (answer: string) => void) => {
      const ans = answers[idx] ?? "";
      idx += 1;
      cb(ans);
    },
    close: () => {},
  }));
  try {
    return fn();
  } finally {
    restore.mock.restore();
  }
}

test("interactiveCommit fluxo feliz cria mensagem e commita (autoPush)", async () => {
  await withGitStub("c", async () => {
    const prevCwd = process.cwd();
    const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-commit-"));
    const gitDir = join(tmp, ".git");
    mkdirSync(gitDir, { recursive: true });
    process.chdir(tmp);
    const prevTty = process.stdin.isTTY;
    // Forçar select a escolher primeiro tipo Não-TTY
    // @ts-ignore
    process.stdin.isTTY = false;
    try {
      // answers: scope, subject, body, breaking, (no breaking details)
      await withReadlineStub(
        ["core", "add login", "", "n"],
        async () => {
          const interactiveCommit = await loadInteractiveCommit();
          const rc = await interactiveCommit("en", { autoPush: true });
          assert.strictEqual(rc, 0);
          const msg = readFileSync(join(gitDir, "COMMIT_EDITMSG"), "utf8");
          assert.ok(msg.includes("feat(core): add login"));
        }
      );
    } finally {
      // @ts-ignore
      process.stdin.isTTY = prevTty;
      process.chdir(prevCwd);
    }
  });
});

function withReadlineCancel(fn: () => Promise<void> | void) {
  const restore = mock.method(readline, "createInterface", () => {
    let sigintHandler: ((...args: any[]) => void) | null = null;
    return {
      once: (_event: string, handler: any) => {
        sigintHandler = handler;
        // Simula Ctrl+C imediatamente
        setImmediate(() => sigintHandler && sigintHandler());
      },
      removeListener: () => {},
      question: (_q: string, _cb: (answer: string) => void) => {
        // não chama callback, pois já cancelamos via SIGINT
      },
      close: () => {},
    } as any;
  });
  try {
    return fn();
  } finally {
    restore.mock.restore();
  }
}

test("interactiveCommit cancelado nos prompts retorna 130", async () => {
  await withGitStub("c", async () => {
    await withReadlineCancel(async () => {
      const interactiveCommit = await loadInteractiveCommit();
      const rc = await interactiveCommit("en", {});
      assert.strictEqual(rc, 130);
    });
  });
});
/* eslint-disable no-useless-escape */
import assert from "node:assert";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";

async function withGitStub(mode: "a" | "b" | "c", fn: () => Promise<void> | void) {
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
    return await fn();
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

async function withTestAnswers(answers: string[], fn: () => Promise<void> | void) {
  const prevNodeTest = process.env.NODE_TEST;
  const prevAns = process.env.COMMITZERO_TEST_ANSWERS;
  process.env.NODE_TEST = "1";
  process.env.COMMITZERO_TEST_ANSWERS = JSON.stringify(answers);
  try {
    return await fn();
  } finally {
    if (prevNodeTest === undefined) delete (process.env as any).NODE_TEST;
    else process.env.NODE_TEST = prevNodeTest as string;
    if (prevAns === undefined) delete (process.env as any).COMMITZERO_TEST_ANSWERS;
    else process.env.COMMITZERO_TEST_ANSWERS = prevAns as string;
  }
}

test("interactiveCommit fluxo feliz cria mensagem e commita (autoPush)", async () => {
  await withGitStub("c", async () => {
    const prevCwd = process.cwd();
    const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-commit-"));
    const gitDir = join(tmp, ".git");
    mkdirSync(gitDir, { recursive: true });
    process.chdir(tmp);
    const prevSkip = process.env.COMMITSKIP_SELECT_PROMPT;
    process.env.COMMITSKIP_SELECT_PROMPT = "1";
    try {
      await withTestAnswers(["core", "add login", "", "n"], async () => {
        const interactiveCommit = await loadInteractiveCommit();
        const rc = await interactiveCommit("en", { autoPush: true });
        assert.strictEqual(rc, 0);
        const msg = readFileSync(join(gitDir, "COMMIT_EDITMSG"), "utf8");
        assert.ok(msg.includes("feat(core): add login"));
      });
    } finally {
      if (prevSkip === undefined) delete (process.env as any).COMMITSKIP_SELECT_PROMPT;
      else process.env.COMMITSKIP_SELECT_PROMPT = prevSkip as string;
      process.chdir(prevCwd);
    }
  });
});

function withReadlineCancel(fn: () => Promise<void> | void) {
  return withTestAnswers(["__SIGINT__"], fn);
}

test("interactiveCommit cancelado nos prompts retorna 130", async () => {
  await withGitStub("c", async () => {
    const prevSkip = process.env.COMMITSKIP_SELECT_PROMPT;
    process.env.COMMITSKIP_SELECT_PROMPT = "1";
    try {
      await withReadlineCancel(async () => {
        const interactiveCommit = await loadInteractiveCommit();
        const rc = await interactiveCommit("en", {});
        assert.strictEqual(rc, 130);
      });
    } finally {
      if (prevSkip === undefined) delete (process.env as any).COMMITSKIP_SELECT_PROMPT;
      else process.env.COMMITSKIP_SELECT_PROMPT = prevSkip as string;
    }
  });
});

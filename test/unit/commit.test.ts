/* eslint-disable no-useless-escape */
import assert from "node:assert";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";

async function withGitStub(mode: "a" | "b" | "c" | "d" | "lock", fn: () => Promise<void> | void) {
  const tmp = mkdtempSync(join(os.tmpdir(), "commitzero-git-"));
  const gitPath = join(tmp, "git");
  const statusCountFile = join(tmp, "status-count");
  const script = `#!/usr/bin/env bash\n
mode=\"$GIT_STUB_MODE\"\n
cmd=\"$1\"\n
if [ \"$cmd\" = \"status\" ]; then\n  if [ \"$2\" = \"--porcelain=v1\" ] && [ \"$3\" = \"-z\" ]; then\n    if [ \"$mode\" = \"a\" ]; then\n      exit 0\n    elif [ \"$mode\" = \"b\" ]; then\n      printf \" M file.txt\\0\"\n      exit 0\n    elif [ \"$mode\" = \"c\" ]; then\n      printf \"M  file.txt\\0\"\n      exit 0\n    elif [ \"$mode\" = \"d\" ]; then\n      printf \" M file.txt\\0\"\n      exit 0\n    elif [ \"$mode\" = \"lock\" ]; then\n      if [ ! -f \"${statusCountFile}\" ]; then\n        echo \"fatal: Unable to create '${tmp}/.git/index.lock': File exists.\" 1>&2\n        echo \"1\" > \"${statusCountFile}\"\n        exit 128\n      fi\n      printf \" M file.txt\\0\"\n      exit 0\n    fi\n  fi\nfi\n
if [ \"$cmd\" = \"diff\" ]; then\n  if [ \"$2\" = \"--cached\" ] && [ \"$3\" = \"--name-only\" ]; then\n    echo \"\"\n    exit 0\n  fi\n  if [ \"$2\" = \"--name-only\" ]; then\n    echo \"\"\n    exit 0\n  fi\nfi\n
if [ \"$cmd\" = \"ls-files\" ]; then\n  exit 0\nfi\n
if [ \"$cmd\" = \"rev-list\" ]; then\n  echo \"1\"\n  exit 0\nfi\n
if [ \"$cmd\" = \"add\" ]; then\n  exit 0\nfi\nif [ \"$cmd\" = \"commit\" ]; then\n  if [ \"$mode\" = \"d\" ]; then\n    echo \"nothing to commit\" 1>&2\n    exit 1\n  fi\n  exit 0\nfi\nif [ \"$cmd\" = \"push\" ]; then\n  exit 0\nfi\n
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
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {}
  }
}

async function loadInteractiveCommit() {
  const require = createRequire(import.meta.url);
  const mod = require("../../dist/cjs/cli/commands/commit.js");
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
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {}
    }
  });
});

test("interactiveCommit com alteracoes nao staged e commits a enviar nao faz push-only", async () => {
  await withGitStub("d", async () => {
    const prevSkip = process.env.COMMITSKIP_SELECT_PROMPT;
    process.env.COMMITSKIP_SELECT_PROMPT = "1";
    try {
      await withTestAnswers(["core", "add login", "", "n"], async () => {
        const interactiveCommit = await loadInteractiveCommit();
        const rc = await interactiveCommit("en", { autoPush: true });
        assert.strictEqual(rc, 1);
      });
    } finally {
      if (prevSkip === undefined) delete (process.env as any).COMMITSKIP_SELECT_PROMPT;
      else process.env.COMMITSKIP_SELECT_PROMPT = prevSkip as string;
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

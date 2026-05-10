/* eslint-disable no-control-regex */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline";
import { inspect } from "node:util";
import { formatMessage } from "../../core/formatter.js";
import { defaultOptions, lintCommit, type ParsedCommit } from "../../core/rules.js";
import { t, type Lang } from "../../i18n/index.js";
import { resolveGitBin } from "../../utils/binaries.js";
import { c } from "../colors.js";
import { select } from "./select.js";

type TestAnswerCtx = { answers: string[] | null; index: number; raw: string | null };
function getGitBin(): string {
  return resolveGitBin();
}
function initTestAnswerCtx(): TestAnswerCtx {
  try {
    const raw = process.env.COMMITZERO_TEST_ANSWERS ?? null;
    if (raw) {
      const arr = JSON.parse(raw);
      return { answers: Array.isArray(arr) ? arr : null, index: 0, raw };
    }
    return { answers: null, index: 0, raw: null };
  } catch {
    return { answers: null, index: 0, raw: null };
  }
}

function showSpinner(message: string): () => void {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  process.stdout.write(message + " ");

  const interval = setInterval(() => {
    process.stdout.write("\r" + message + " " + c.cyan(frames[i]));
    i = (i + 1) % frames.length;
  }, 100);

  return () => {
    clearInterval(interval);
    process.stdout.write("\r" + message + " " + c.green("✓") + "\n");
  };
}

function runWithSpinner<T>(message: string, fn: () => T): T {
  const stop = showSpinner(message);
  try {
    const res = fn();
    stop();
    return res;
  } catch (err) {
    stop();
    throw err;
  }
}

function sanitizeInputSafe(input: string): string {
  // Remove caracteres de controle perigosos, mas preserva caracteres Unicode válidos e espaços
  return input
    .replaceAll(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "") // Remove caracteres de controle
    .replaceAll(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
      // Preserva espaços (0x20) e tabs (0x09) se necessário
      return match === "\x20" ? match : "";
    }) // Remove caracteres de controle Unicode mas preserva espaços
    .replaceAll(/[\u2028\u2029]/g, ""); // Remove separadores de linha Unicode
}

type InteractiveCommitCfg = Partial<typeof defaultOptions> & {
  autoAdd?: boolean;
  autoPush?: boolean;
  pushProgress?: boolean;
  uiAltScreen?: boolean;
  preCommitTimeout?: string | number;
};

function resolveCliVersionSuffix(): string {
  try {
    const pkgPath1 = join(__dirname, "../../../../package.json");
    const raw1 = readFileSync(pkgPath1, "utf8");
    const pkg1 = JSON.parse(raw1);
    return pkg1?.version ? ` v${pkg1.version}` : "";
  } catch {
    try {
      const pkgPath2 = require.resolve("@codemastersolutions/commitzero/package.json");
      const raw2 = readFileSync(pkgPath2, "utf8");
      const pkg2 = JSON.parse(raw2);
      return pkg2?.version ? ` v${pkg2.version}` : "";
    } catch {
      const envVersion = process.env.npm_package_version;
      return envVersion ? ` v${envVersion}` : "";
    }
  }
}

function isInteractiveInput(): boolean {
  const forceNonInteractive =
    process.env.COMMITSKIP_INPUT_PROMPT === "1" ||
    process.env.CI === "true" ||
    process.env.NODE_TEST === "1";
  return !!process.stdin.isTTY && !forceNonInteractive;
}

function isYesAnswer(answer: string): boolean {
  return /^y(es)?$/i.test((answer || "").trim());
}

function createYesNoValidator(lang: Lang): (answer: string) => boolean | string {
  return (answer: string): boolean | string => {
    const trimmed = answer.trim().toLowerCase();
    if (
      trimmed === "" ||
      trimmed === "n" ||
      trimmed === "no" ||
      trimmed === "y" ||
      trimmed === "yes"
    ) {
      return true;
    }
    return t(lang, "commit.validation.yesNo") || "Please answer with 'y' or 'n'";
  };
}

function validateScopeValue(lang: Lang, value: string): string | null {
  const s = value.trim();
  if (s === "") return null;
  const patternOk = /^[\p{L}\p{N}\p{M}\p{P}\p{S}\- .]+$/u.test(s);
  if (!patternOk) return t(lang, "rules.scopePattern") || "Scope contains invalid characters.";
  if (s !== s.toLowerCase()) return t(lang, "rules.scopeLower") || "Scope must be lowercase.";
  return null;
}

async function promptScope(
  rl: readline.Interface,
  lang: Lang,
  isScopeRequired: boolean,
  testCtx: TestAnswerCtx
): Promise<string> {
  for (;;) {
    const scope = await askWithCharacterCount(
      rl,
      c.cyan(t(lang, "commit.prompt.scope")),
      50,
      testCtx,
      isScopeRequired,
      lang,
      true
    );
    const err = validateScopeValue(lang, scope);
    if (!err) return scope;
    console.log(c.red(err));
  }
}

async function promptCommitParts(
  rl: readline.Interface,
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined,
  testCtx: TestAnswerCtx
): Promise<{
  scope: string;
  subject: string;
  body: string;
  isBreaking: boolean;
  breakingDetails: string;
}> {
  const scope = await promptScope(rl, lang, !!cfg?.requireScope, testCtx);
  if (!isInteractiveInput()) console.log();

  const subject = await askWithCharacterCount(
    rl,
    c.cyan(t(lang, "commit.prompt.subject")),
    cfg?.maxSubjectLength || 72,
    testCtx,
    true,
    lang,
    true
  );
  const body = await askWithCharacterCount(
    rl,
    c.cyan(t(lang, "commit.prompt.body")),
    500,
    testCtx,
    false,
    lang,
    true
  );

  const yesNoValidator = createYesNoValidator(lang);

  const breakingAns = await askWithValidation(
    rl,
    c.cyan(t(lang, "commit.prompt.breaking")),
    yesNoValidator,
    testCtx,
    false,
    lang
  );
  const isBreaking = isYesAnswer(breakingAns);
  const breakingDetails = isBreaking
    ? await askWithCharacterCount(
        rl,
        c.cyan(t(lang, "commit.prompt.breakingDetails")),
        200,
        testCtx,
        false,
        lang,
        true
      )
    : "";

  return { scope, subject, body, isBreaking, breakingDetails };
}

function gitCommitEditMsg(cfg: InteractiveCommitCfg | undefined): string {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    COMMITZERO: "1",
    COMMITZERO_RUN: "1",
  };
  if (cfg?.preCommitTimeout !== undefined) {
    env.COMMITZERO_PRE_COMMIT_TIMEOUT = String(cfg.preCommitTimeout);
  }
  return execFileSync(getGitBin(), ["commit", "-F", ".git/COMMIT_EDITMSG"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env,
  });
}

function getCurrentBranchName(): string | null {
  try {
    const branch = execFileSync(getGitBin(), ["rev-parse", "--abbrev-ref", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    })
      .toString()
      .trim();
    if (!branch || branch === "HEAD") return null;
    return branch;
  } catch {
    return null;
  }
}

function getDefaultRemoteName(): string {
  try {
    const out = execFileSync(getGitBin(), ["remote"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    })
      .toString()
      .trim();
    const first = out
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.length > 0);
    return first || "origin";
  } catch {
    return "origin";
  }
}

function gitPush(cfg: InteractiveCommitCfg | undefined, withUpstream: boolean): string {
  const useProgress = cfg?.pushProgress !== false;
  if (!withUpstream) {
    return execFileSync(getGitBin(), ["push", ...(useProgress ? ["--progress"] : [])], {
      stdio: ["ignore", "pipe", useProgress ? "inherit" : "pipe"],
      encoding: "utf8",
    });
  }
  const branch = getCurrentBranchName();
  if (!branch) {
    throw new Error("Current branch is detached; cannot push.");
  }
  const remote = getDefaultRemoteName();
  return execFileSync(
    getGitBin(),
    ["push", ...(useProgress ? ["--progress"] : []), "-u", remote, branch],
    {
      stdio: ["ignore", "pipe", useProgress ? "inherit" : "pipe"],
      encoding: "utf8",
    }
  );
}

function pushAfterCommitIfNeeded(lang: Lang, cfg: InteractiveCommitCfg | undefined): number {
  if (!cfg?.autoPush) return 0;
  const stopPushSpinner = showSpinner(t(lang, "commit.pushing") || "Pushing to remote...");
  try {
    const pushOut = gitPush(cfg, false);
    stopPushSpinner();
    if (pushOut) process.stdout.write(pushOut);
    return 0;
  } catch {
    stopPushSpinner();
    try {
      const pushUpOut = runWithSpinner("Setting upstream and pushing...", () => gitPush(cfg, true));
      if (pushUpOut) process.stdout.write(pushUpOut);
      return 0;
    } catch (error_: unknown) {
      const errOut = error_ && error_ instanceof Error ? error_.message : "";
      if (errOut) process.stderr.write(errOut);
      console.error(c.red(String(error_)));
      return 1;
    }
  }
}

type GitStatusState = { hasStaged: boolean; hasUnstaged: boolean; undetermined: boolean };

function sleepSync(ms: number): void {
  if (ms <= 0) return;
  const arr = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(arr, 0, 0, ms);
}

function readGitErrorText(err: unknown): string {
  const anyErr = err as Record<string, unknown>;
  const stderr = anyErr?.stderr;

  let stderrText = "";
  if (Buffer.isBuffer(stderr)) stderrText = stderr.toString("utf8");
  else if (typeof stderr === "string") stderrText = stderr;

  const rawMessage = anyErr?.message;
  let messageText = "";
  if (typeof rawMessage === "string") {
    messageText = rawMessage;
  } else if (rawMessage instanceof Error) {
    messageText = rawMessage.message;
  } else if (rawMessage !== undefined) {
    try {
      messageText = JSON.stringify(rawMessage);
    } catch {
      messageText = inspect(rawMessage);
    }
  }

  return `${messageText}\n${stderrText}`.trim();
}

function isTransientGitError(err: unknown): boolean {
  const text = readGitErrorText(err).toLowerCase();
  return (
    text.includes("index.lock") ||
    text.includes("could not lock") ||
    text.includes("unable to create") ||
    text.includes("another git process") ||
    text.includes("fatal: unable to") ||
    text.includes("fatal: could not") ||
    text.includes("resource temporarily unavailable")
  );
}

function execGitUtf8(
  args: string[],
  stdio: ["ignore", "pipe", "pipe"] | undefined = undefined
): string {
  return execFileSync(getGitBin(), args, {
    stdio: stdio ?? ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function execGitUtf8WithRetry(args: string[], maxRetries: number = 6): string {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return execGitUtf8(args);
    } catch (err: unknown) {
      lastErr = err;
      if (!isTransientGitError(err) || attempt === maxRetries) break;
      sleepSync(50 * (attempt + 1));
    }
  }
  throw lastErr;
}

function parsePorcelainV1Z(out: string): GitStatusState {
  const applyXY = (state: { hasStaged: boolean; hasUnstaged: boolean }, x: string, y: string) => {
    if (x === "?" && y === "?") {
      state.hasUnstaged = true;
      return;
    }
    if (x !== " " && x !== "?") state.hasStaged = true;
    if (y !== " " && y !== "?") state.hasUnstaged = true;
  };

  const consumePath = (raw: string, from: number): number => {
    const term = raw.indexOf("\0", from);
    return term === -1 ? raw.length : term + 1;
  };

  const shouldConsumeSecondPath = (x: string, y: string): boolean => {
    return x === "R" || x === "C" || y === "R" || y === "C";
  };

  const raw = out ?? "";
  const state = { hasStaged: false, hasUnstaged: false };
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === "\0") {
      i++;
      continue;
    }
    if (i + 2 > raw.length) break;

    const x = raw[i];
    const y = raw[i + 1];
    applyXY(state, x, y);

    const next = consumePath(raw, i);
    if (next >= raw.length) break;
    i = next;

    if (!shouldConsumeSecondPath(x, y) || i >= raw.length || raw[i] === "\0") continue;
    i = consumePath(raw, i);
  }

  return { hasStaged: state.hasStaged, hasUnstaged: state.hasUnstaged, undetermined: false };
}

function getGitStatusState(): GitStatusState {
  try {
    const out = execGitUtf8WithRetry(["status", "--porcelain=v1", "-z"]);
    return parsePorcelainV1Z(out);
  } catch {
    try {
      const stagedOut = execGitUtf8WithRetry(["diff", "--cached", "--name-only"]).trim();
      const diffOut = execGitUtf8WithRetry(["diff", "--name-only"]).trim();
      const untrackedOut = execGitUtf8WithRetry([
        "ls-files",
        "--others",
        "--exclude-standard",
      ]).trim();
      return {
        hasStaged: stagedOut.length > 0,
        hasUnstaged: diffOut.length > 0 || untrackedOut.length > 0,
        undetermined: false,
      };
    } catch {
      return { hasStaged: false, hasUnstaged: true, undetermined: true };
    }
  }
}

function hasStaged(): boolean {
  return getGitStatusState().hasStaged;
}

function hasUnstagedChanges(): boolean {
  return getGitStatusState().hasUnstaged;
}

function parseCount(raw: string): number {
  const n = Number.parseInt((raw || "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function getAheadCount(): number {
  try {
    const out = execFileSync(getGitBin(), ["rev-list", "--count", "@{u}..HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).toString();
    return parseCount(out);
  } catch {
    try {
      const out = execFileSync(getGitBin(), ["rev-list", "--count", "HEAD"], {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      }).toString();
      return parseCount(out);
    } catch {
      return 0;
    }
  }
}

function gitAddAll(lang: Lang): boolean {
  try {
    const out = execFileSync(getGitBin(), ["add", "-A"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    if (out) process.stdout.write(out);
    console.log(c.green(t(lang, "commit.git.added") || "Files added to staging area."));
    return true;
  } catch (err: unknown) {
    const errOut = err && err instanceof Error ? err.message : "";
    if (errOut) process.stderr.write(errOut);
    console.error(c.red(String(err)));
    return false;
  }
}

async function pushIfAhead(
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined
): Promise<"push_success" | false> {
  const ahead = getAheadCount();
  if (ahead <= 0) return false;
  console.log(
    c.cyan(
      t(lang, "commit.git.nothingToCommit") || "Nothing to commit, but there are unpushed commits."
    )
  );
  const stop = showSpinner(t(lang, "commit.pushing") || "Pushing to remote...");
  try {
    const pushOut = gitPush(cfg, false);
    stop();
    if (pushOut) process.stdout.write(pushOut);
    console.log(c.green(t(lang, "commit.git.pushed") || "Successfully pushed to remote."));
    return "push_success";
  } catch {
    stop();
  }
  try {
    const pushUpOut = runWithSpinner("Setting upstream and pushing...", () => gitPush(cfg, true));
    if (pushUpOut) process.stdout.write(pushUpOut);
    console.log(c.green(t(lang, "commit.git.pushed") || "Successfully pushed to remote."));
    return "push_success";
  } catch (error_: unknown) {
    const errOut = error_ && error_ instanceof Error ? error_.message : "";
    if (errOut) process.stderr.write(errOut);
    console.error(c.red(String(error_)));
    return false;
  }
}

async function promptAddIfNeeded(
  lang: Lang,
  testCtx: TestAnswerCtx,
  skipBehavior: "abort" | "continue"
): Promise<boolean | "skip"> {
  const skipAddPrompt =
    process.env.COMMITSKIP_ADD_PROMPT === "1" ||
    process.env.CI === "true" ||
    process.env.NODE_TEST === "1";
  if (skipAddPrompt) return skipBehavior === "continue" ? "skip" : false;
  const isInteractive = !!input.isTTY && !!output.isTTY;
  if (!isInteractive) return false;

  const yesNoValidator = createYesNoValidator(lang);

  const localRl = readline.createInterface({ input, output });
  try {
    const ans = await askWithValidation(
      localRl,
      c.cyan(t(lang, "commit.git.askAdd")),
      yesNoValidator,
      testCtx,
      false,
      lang
    );
    return isYesAnswer(ans);
  } catch {
    console.log(c.yellow(t(lang, "commit.cancelled")));
    return false;
  } finally {
    localRl.close();
    try {
      input.pause?.();
    } catch {}
  }
}

function getAddScenario(params: {
  staged: boolean;
  unstaged: boolean;
  autoAdd: boolean;
  autoPush: boolean;
}):
  | "NO_CHANGES"
  | "AUTO_ADD"
  | "AUTO_PUSH_PROMPT"
  | "PROMPT_ADD_ABORT"
  | "PROMPT_ADD_CONTINUE"
  | "DEFAULT" {
  const { staged, unstaged, autoAdd, autoPush } = params;
  if (!staged && !unstaged) return "NO_CHANGES";
  if (autoAdd && unstaged) return "AUTO_ADD";
  if (staged && unstaged && !autoAdd) return "PROMPT_ADD_CONTINUE";
  if (autoPush && unstaged && !autoAdd) return "AUTO_PUSH_PROMPT";
  if (!staged && unstaged && !autoAdd && !autoPush) return "PROMPT_ADD_ABORT";
  return "DEFAULT";
}

async function handleNoChangesScenario(
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined,
  autoPush: boolean
): Promise<boolean | "push_success"> {
  if (autoPush) {
    const pushed = await pushIfAhead(lang, cfg);
    if (pushed === "push_success") return "push_success";
  }
  console.error(c.red(t(lang, "commit.git.abort")));
  return false;
}

function handleAutoAddScenario(lang: Lang, autoPush: boolean): boolean {
  if (!gitAddAll(lang)) return false;
  return hasStaged() || autoPush;
}

async function handleAutoPushPromptScenario(
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined,
  testCtx: TestAnswerCtx
): Promise<boolean> {
  const wantsAdd = await promptAddIfNeeded(lang, testCtx, "continue");
  if (wantsAdd === true && !gitAddAll(lang)) return false;
  return hasStaged() || !!cfg?.autoPush;
}

async function handlePromptAddContinueScenario(
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined,
  testCtx: TestAnswerCtx
): Promise<boolean> {
  const wantsAdd = await promptAddIfNeeded(lang, testCtx, "continue");
  if (wantsAdd === true && !gitAddAll(lang)) return false;
  return hasStaged() || !!cfg?.autoPush;
}

async function handlePromptAddAbortScenario(lang: Lang, testCtx: TestAnswerCtx): Promise<boolean> {
  const wantsAdd = await promptAddIfNeeded(lang, testCtx, "abort");
  if (wantsAdd !== true) {
    console.error(c.red(t(lang, "commit.git.abort")));
    return false;
  }
  if (!gitAddAll(lang)) return false;
  return hasStaged();
}

async function checkAndAskForAdd(
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined,
  testCtx: TestAnswerCtx
): Promise<boolean | "push_success"> {
  const autoAdd = cfg?.autoAdd === true;
  const autoPush = cfg?.autoPush === true;
  const staged = hasStaged();
  const unstaged = hasUnstagedChanges();
  const scenario = getAddScenario({ staged, unstaged, autoAdd, autoPush });

  switch (scenario) {
    case "NO_CHANGES":
      return handleNoChangesScenario(lang, cfg, autoPush);
    case "AUTO_ADD":
      return handleAutoAddScenario(lang, autoPush);
    case "AUTO_PUSH_PROMPT":
      return handleAutoPushPromptScenario(lang, cfg, testCtx);
    case "PROMPT_ADD_CONTINUE":
      return handlePromptAddContinueScenario(lang, cfg, testCtx);
    case "PROMPT_ADD_ABORT":
      return handlePromptAddAbortScenario(lang, testCtx);
    default:
      return hasStaged();
  }
}

async function selectCommitType(
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined
): Promise<string | null> {
  const types = cfg?.types?.length ? cfg.types : defaultOptions.types;
  const items = types.map((ty) => ({
    value: ty,
    label: `${ty}:`,
    description: t(lang, `type.desc.${ty}`),
  }));
  try {
    const selected = await select(c.bold(t(lang, "commit.select.type")), items, undefined, {
      useAltScreen: cfg?.uiAltScreen,
    });
    return selected || null;
  } catch {
    return null;
  }
}

async function promptCommitPartsSafely(
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined,
  testCtx: TestAnswerCtx
): Promise<Awaited<ReturnType<typeof promptCommitParts>> | null> {
  const rl = readline.createInterface({ input, output });
  try {
    return await promptCommitParts(rl, lang, cfg, testCtx);
  } catch {
    return null;
  } finally {
    rl.close();
    try {
      input.pause?.();
    } catch {}
  }
}

function buildParsedCommit(
  type: string,
  parts: Awaited<ReturnType<typeof promptCommitParts>>
): ParsedCommit {
  const { scope, subject, body, isBreaking, breakingDetails } = parts;
  const footers = isBreaking ? [{ key: "BREAKING CHANGE", value: breakingDetails }] : [];
  const scopePart = scope ? `(${scope})` : "";
  const breakingMark = isBreaking && !subject.includes("!") ? "!" : "";
  return {
    type,
    scope: scope || undefined,
    subject,
    body: body || undefined,
    isBreaking,
    footers,
    meta: {
      header: `${type}${scopePart}${breakingMark}: ${subject}`,
      hasBlankAfterHeader: !!body,
      hasBlankBeforeFooter: footers.length > 0,
    },
  };
}

function validateCommitOrExit(
  lang: Lang,
  cfg: InteractiveCommitCfg | undefined,
  commit: ParsedCommit
): number | null {
  const result = lintCommit(commit, { ...defaultOptions, ...cfg, language: lang });
  if (!result.valid) {
    console.error(
      c.red(t(lang, "cli.invalid")) + "\n" + result.errors.map((e) => c.red(`- ${e}`)).join("\n")
    );
    return 1;
  }
  if (result.warnings.length) {
    console.warn(
      result.warnings.map((w) => c.yellow(t(lang, "cli.warning", { msg: w }))).join("\n")
    );
  }
  return null;
}

function writeAndPrintCommitMessage(lang: Lang, msg: string): void {
  writeFileSync(".git/COMMIT_EDITMSG", msg, "utf8");
  const createdHdr = t(lang, "commit.created", { msg: "" }).trimEnd();
  console.log("\n" + c.green(createdHdr));
  console.log("\n" + msg + "\n");
}

function commitAndPush(lang: Lang, cfg: InteractiveCommitCfg | undefined): number {
  try {
    const commitOut = runWithSpinner(t(lang, "commit.committing") || "Committing changes...", () =>
      gitCommitEditMsg(cfg)
    );
    console.log("");
    if (commitOut) process.stdout.write(commitOut);
    return pushAfterCommitIfNeeded(lang, cfg);
  } catch (err: unknown) {
    const errOut = err && err instanceof Error ? err.message : "";
    if (errOut) process.stderr.write(errOut);
    console.error(c.red(String(err)));
    return 1;
  }
}

function askWithCharacterCount(
  rl: readline.Interface,
  q: string,
  maxLength?: number,
  ctx?: TestAnswerCtx,
  isRequired?: boolean,
  lang?: Lang,
  nextLineInput: boolean = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const readFromCtx = (): string | undefined => {
      if (ctx?.answers && ctx.index < ctx.answers.length) {
        const answer = ctx.answers[ctx.index++];
        if (answer === "__SIGINT__") {
          throw new Error("SIGINT");
        }
        const sanitizedAnswer = sanitizeInputSafe(answer);
        if (isRequired && (!sanitizedAnswer || sanitizedAnswer.trim().length === 0)) {
          if (process.env.NODE_TEST === "1") {
            return sanitizedAnswer;
          }
        }
        return sanitizedAnswer;
      }

      if (ctx?.raw) {
        if (ctx.raw.includes("__SIGINT__")) {
          throw new Error("SIGINT");
        }
        return sanitizeInputSafe(ctx.raw);
      }

      return undefined;
    };

    const resolveFromCtxIfAny = (): boolean => {
      try {
        const fromCtx = readFromCtx();
        if (fromCtx === undefined) return false;
        resolve(fromCtx);
        return true;
      } catch (err) {
        reject(err);
        return true;
      }
    };

    const promptWithCount = (currentInput: string = "", cursorPos: number = 0) => {
      const count = currentInput.length;
      const countDisplay = maxLength ? ` (${count}/${maxLength})` : ` (${count})`;
      const coloredCount =
        maxLength && count > maxLength ? c.red(countDisplay) : c.gray(countDisplay);
      const prompt = q + coloredCount;
      const inputPrefix = `${coloredCount} `; // contador no início da linha da resposta
      return { prompt, inputPrefix, cursorPos };
    };

    if (resolveFromCtxIfAny()) return;

    let currentInput = "";
    let cursorPosition = 0;

    // Verificar se devemos forçar modo não-interativo (CI/testes)
    const forceNonInteractive =
      process.env.COMMITSKIP_INPUT_PROMPT === "1" ||
      process.env.CI === "true" ||
      process.env.NODE_TEST === "1";
    const isInteractive = !!process.stdin.isTTY && !forceNonInteractive;

    if (!isInteractive) {
      // Em ambientes não interativos, não bloquear esperando entrada
      try {
        input.pause?.();
      } catch {}
      resolve("");
      return;
    }

    // Modo interativo com contador em tempo real e suporte a cursor
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    const maxLengthValidator = (answer: string): boolean | string => {
      if (!maxLength) return true;
      if (answer.length <= maxLength) return true;
      return `Entrada excede o limite de ${maxLength} caracteres. Tente novamente.`;
    };
    if (typeof (stdin as NodeJS.ReadStream & { setRawMode?: unknown }).setRawMode !== "function") {
      askWithValidation(rl, q, maxLengthValidator, undefined, isRequired, lang, nextLineInput)
        .then(resolve)
        .catch(reject);
      return;
    }
    try {
      stdin.setRawMode(true);
    } catch {
      askWithValidation(rl, q, maxLengthValidator, undefined, isRequired, lang, nextLineInput)
        .then(resolve)
        .catch(reject);
      return;
    }
    stdin.resume();
    stdin.setEncoding("utf8");

    // Se solicitado, mostrar a pergunta e aceitar a digitação na linha abaixo
    if (nextLineInput) {
      console.log(q);
    }

    const updatePrompt = () => {
      // Calcular quantas linhas o prompt atual pode ocupar
      const { prompt, inputPrefix } = promptWithCount(currentInput, cursorPosition);
      const terminalWidth = process.stdout.columns || 80;
      const fullLine = nextLineInput ? inputPrefix + currentInput : prompt + " " + currentInput;
      const linesUsed = Math.ceil(fullLine.length / terminalWidth);

      // Limpar todas as linhas que podem ter sido usadas
      for (let i = 0; i < linesUsed; i++) {
        if (i > 0) {
          process.stdout.write("\x1b[1A"); // Mover cursor uma linha para cima
        }
        process.stdout.write("\r\x1b[K"); // Limpar linha atual
      }

      // Mostrar prompt atualizado
      const beforeCursor = currentInput.slice(0, cursorPosition);
      const afterCursor = currentInput.slice(cursorPosition);

      if (nextLineInput) {
        process.stdout.write(inputPrefix + beforeCursor + afterCursor);
      } else {
        process.stdout.write(prompt + " " + beforeCursor + afterCursor);
      }

      // Mover cursor para a posição correta
      if (afterCursor.length > 0) {
        process.stdout.write(`\x1b[${afterCursor.length}D`);
      }
    };

    const showErrorAndContinue = (message: string) => {
      // Calcular quantas linhas o prompt atual pode ocupar
      const { prompt, inputPrefix } = promptWithCount(currentInput, cursorPosition);
      const terminalWidth = process.stdout.columns || 80;
      const fullLine = nextLineInput ? inputPrefix + currentInput : prompt + " " + currentInput;
      const linesUsed = Math.ceil(fullLine.length / terminalWidth);

      // Limpar todas as linhas que podem ter sido usadas
      for (let i = 0; i < linesUsed; i++) {
        if (i > 0) {
          process.stdout.write("\x1b[1A"); // Mover cursor uma linha para cima
        }
        process.stdout.write("\r\x1b[K"); // Limpar linha atual
      }

      // Mover cursor para nova linha e mostrar erro
      process.stdout.write("\n");
      console.log(c.red(message));
      // Voltar para a entrada mantendo o foco
      updatePrompt();
    };

    // Mostrar prompt inicial
    updatePrompt();

    function cleanup() {
      stdin.removeListener("data", onKeypress);
      stdin.setRawMode(wasRaw);
      if (!wasRaw) {
        stdin.pause();
      }
      process.removeListener("SIGINT", onSigInt);
    }

    function onSigInt() {
      cleanup();
      reject(new Error("SIGINT"));
    }

    function handleEnter() {
      const sanitizedInput = sanitizeInputSafe(currentInput);
      if (maxLength && sanitizedInput.length > maxLength) {
        showErrorAndContinue(
          `Entrada excede o limite de ${maxLength} caracteres. Tente novamente.`
        );
        return;
      }
      if (isRequired && (!sanitizedInput || sanitizedInput.trim().length === 0)) {
        const errorMessage = lang
          ? t(lang, "commit.validation.required") ||
            "Este campo é obrigatório. Por favor, forneça uma resposta."
          : "Este campo é obrigatório. Por favor, forneça uma resposta.";
        showErrorAndContinue(errorMessage);
        return;
      }
      process.stdout.write("\n");
      cleanup();
      resolve(sanitizedInput);
    }

    function handleBackspace() {
      if (cursorPosition <= 0) return;
      currentInput = currentInput.slice(0, cursorPosition - 1) + currentInput.slice(cursorPosition);
      cursorPosition--;
      updatePrompt();
    }

    function handleLeft() {
      if (cursorPosition <= 0) return;
      cursorPosition--;
      updatePrompt();
    }

    function handleRight() {
      if (cursorPosition >= currentInput.length) return;
      cursorPosition++;
      updatePrompt();
    }

    function handleHome() {
      cursorPosition = 0;
      updatePrompt();
    }

    function handleEnd() {
      cursorPosition = currentInput.length;
      updatePrompt();
    }

    function handleDelete() {
      if (cursorPosition >= currentInput.length) return;
      currentInput = currentInput.slice(0, cursorPosition) + currentInput.slice(cursorPosition + 1);
      updatePrompt();
    }

    function handleChar(ch: string) {
      const safeChar = sanitizeInputSafe(ch);
      if (!safeChar) return;
      currentInput =
        currentInput.slice(0, cursorPosition) + safeChar + currentInput.slice(cursorPosition);
      cursorPosition += safeChar.length;
      updatePrompt();
    }

    function onKeypress(key: string) {
      const handlers: Record<string, (() => void) | undefined> = {
        "\u0003": () => {
          cleanup();
          reject(new Error("SIGINT"));
        },
        "\r": handleEnter,
        "\n": handleEnter,
        "\u007f": handleBackspace,
        "\b": handleBackspace,
        "\u001b[D": handleLeft,
        "\u001b[C": handleRight,
        "\u001b[H": handleHome,
        "\u001b[1~": handleHome,
        "\u001b[F": handleEnd,
        "\u001b[4~": handleEnd,
        "\u001b[3~": handleDelete,
      };

      const handler = handlers[key];
      if (handler) {
        handler();
        return;
      }
      const codePoint = key.codePointAt(0);
      if (key.startsWith("\u001b") || codePoint === undefined || codePoint < 32) return;
      handleChar(key);
    }

    stdin.on("data", onKeypress);
    process.on("SIGINT", onSigInt);
  });
}

function askWithValidation(
  rl: readline.Interface,
  q: string,
  validator?: (answer: string) => boolean | string,
  ctx?: TestAnswerCtx,
  isRequired?: boolean,
  lang?: Lang,
  nextLineInput: boolean = false
): Promise<string> {
  const forceNonInteractive =
    process.env.COMMITSKIP_INPUT_PROMPT === "1" ||
    process.env.CI === "true" ||
    process.env.NODE_TEST === "1";
  const isInteractive = !!input.isTTY && !forceNonInteractive;

  const requiredErrorMessage =
    (lang ? t(lang, "commit.validation.required") : "") ||
    "This field is required. Please provide a value.";

  const getValidationError = (value: string): string | null => {
    if (isRequired && (!value || value.trim().length === 0)) return requiredErrorMessage;
    if (!validator) return null;
    const validationResult = validator(value);
    if (validationResult === true) return null;
    return typeof validationResult === "string" ? validationResult : "Invalid input.";
  };

  const readFromCtx = (): string | null => {
    if (!ctx?.answers) return null;
    const ans = (ctx.answers[ctx.index++] ?? "").trim();
    if (ans === "__SIGINT__") {
      throw new Error("cancelled");
    }
    return sanitizeInputSafe(ans);
  };

  const readNonInteractive = (): string => {
    try {
      input.pause?.();
    } catch {}
    return "";
  };

  const readInteractive = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const onSigint = () => {
        rl.removeListener("SIGINT", onSigint);
        reject(new Error("cancelled"));
      };
      rl.once("SIGINT", onSigint);
      if (nextLineInput) console.log(q);
      rl.question(nextLineInput ? "" : q, (answer: string) => {
        rl.removeListener("SIGINT", onSigint);
        resolve(sanitizeInputSafe((answer ?? "").trim()));
      });
    });
  };

  return (async () => {
    for (;;) {
      const ctxValue = readFromCtx();
      let value: string;
      if (ctxValue !== null) value = ctxValue;
      else if (isInteractive) value = await readInteractive();
      else value = readNonInteractive();
      const err = getValidationError(value);
      if (!err) return value;
      if (process.env.NODE_TEST === "1") return value;
      console.log(c.red(err));
    }
  })();
}

export async function interactiveCommit(lang: Lang, cfg?: InteractiveCommitCfg): Promise<number> {
  const version = resolveCliVersionSuffix();
  console.log(c.green(c.bold(`CommitZero CLI${version}`)));
  console.log();
  const testCtx = initTestAnswerCtx();

  const checkResult = await checkAndAskForAdd(lang, cfg, testCtx);
  if (checkResult === false) return 1;
  if (checkResult === "push_success") return 0;

  const type = await selectCommitType(lang, cfg);
  if (!type) {
    console.log(c.yellow(t(lang, "commit.cancelled")));
    return 130;
  }

  console.log();
  console.log(c.green(c.bold(t(lang, "commit.chosen.type", { type }))));
  console.log();

  const parts = await promptCommitPartsSafely(lang, cfg, testCtx);
  if (!parts) {
    console.log(c.yellow(t(lang, "commit.cancelled")));
    return 130;
  }

  const commit = buildParsedCommit(type, parts);
  const invalidCode = validateCommitOrExit(lang, cfg, commit);
  if (invalidCode !== null) return invalidCode;

  const msg = formatMessage(commit);
  writeAndPrintCommitMessage(lang, msg);
  return commitAndPush(lang, cfg);
}

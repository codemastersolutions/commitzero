#!/usr/bin/env node
/* eslint-disable no-control-regex */
import { existsSync, readFileSync, statSync, writeFileSync, accessSync, constants } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { loadConfig, type UserConfig } from "../config/load.js";
import { parseMessage } from "../core/parser.js";
import { defaultOptions, lintCommit, type LintOptions } from "../core/rules.js";
import { cleanupHooks } from "../hooks/cleanup.js";
import { getCurrentHooksPath, installHooks, uninstallHooks } from "../hooks/install.js";
import { updateScripts as ensureScripts } from "../hooks/postinstall.js";
import { DEFAULT_LANG, t } from "../i18n/index.js";
import { resolveGitBin, resolveNpmBin } from "../utils/binaries.js";
import { formatBytes, parseSizeToBytes } from "../utils/size.js";
import { formatDurationMs, parseTimeToMs } from "../utils/time.js";
import { checkForUpdate } from "../version/check.js";
import { c } from "./colors.js";
import { interactiveCommit } from "./commands/commit.js";
import { initConfig } from "./commands/init.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

function getGitBin(): string {
  return resolveGitBin();
}

function getNpmBin(): string {
  return resolveNpmBin();
}

function isAllowedNonInteractiveGitCommit(): boolean {
  try {
    if (existsSync(".git/MERGE_HEAD") || existsSync(".git/MERGE_MSG")) return true;
    if (existsSync(".git/CHERRY_PICK_HEAD")) return true;
    if (existsSync(".git/REVERT_HEAD")) return true;
    if (existsSync(".git/REBASE_HEAD")) return true;
    if (existsSync(".git/rebase-apply") || existsSync(".git/rebase-merge")) return true;
  } catch {}
  return false;
}

function getCurrentVersion(): string {
  try {
    const pkgPath1 = join(__dirname, "../../../package.json");
    const raw1 = readFileSync(pkgPath1, "utf8");
    const pkg1 = JSON.parse(raw1);
    if (pkg1?.version) return String(pkg1.version);
  } catch {
    try {
      const pkgPath2 = require.resolve("@codemastersolutions/commitzero/package.json");
      const raw2 = readFileSync(pkgPath2, "utf8");
      const pkg2 = JSON.parse(raw2);
      if (pkg2?.version) return String(pkg2.version);
    } catch {
      const envVersion = process.env.npm_package_version;
      if (envVersion) return String(envVersion);
    }
  }
  return "";
}

function printHelp(lang: import("../i18n").Lang) {
  let version = "";
  try {
    const pkgPath1 = join(__dirname, "../../../package.json");
    const raw1 = readFileSync(pkgPath1, "utf8");
    const pkg1 = JSON.parse(raw1);
    version = pkg1?.version ? ` v${pkg1.version}` : "";
  } catch {
    try {
      const pkgPath2 = require.resolve("@codemastersolutions/commitzero/package.json");
      const raw2 = readFileSync(pkgPath2, "utf8");
      const pkg2 = JSON.parse(raw2);
      version = pkg2?.version ? ` v${pkg2.version}` : "";
    } catch {
      const envVersion = process.env.npm_package_version;
      if (envVersion) version = ` v${envVersion}`;
    }
  }
  console.log(t(lang, "cli.help", { version }));
}

function sanitizeInput(s: string): string {
  return s.replaceAll(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
}

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err === null) return "null";
  if (err === undefined) return "undefined";
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint")
    return String(err);
  try {
    const json = JSON.stringify(err);
    if (typeof json === "string" && json !== "{}") return json;
  } catch {}
  return inspect(err, { depth: 3, breakLength: 120 });
}

function isYesAnswer(answer: string): boolean {
  const a = (answer || "").trim().toLowerCase();
  return a === "y" || a === "yes" || a === "s" || a === "sim" || a === "sí";
}

function readNestedBoolean(
  cfg: UserConfig,
  key: string,
  nestedKey: string,
  defaultValue: boolean
): boolean {
  const direct = (cfg as UserConfig & Record<string, unknown>)[key];
  if (typeof direct === "boolean") return direct;
  const nested = (cfg as UserConfig & { commitZero?: Record<string, unknown> })?.commitZero?.[
    nestedKey
  ];
  if (typeof nested === "boolean") return nested;
  return defaultValue;
}

function readNestedValue<T>(cfg: UserConfig, key: string, nestedKey: string): T | undefined {
  const direct = (cfg as UserConfig & Record<string, unknown>)[key];
  if (direct !== undefined) return direct as T;
  const nested = (cfg as UserConfig & { commitZero?: Record<string, unknown> })?.commitZero?.[
    nestedKey
  ];
  return nested as T | undefined;
}

function isFlagsOnlyCommand(cmd: string): boolean {
  return (
    cmd === "-a" ||
    cmd === "--add" ||
    cmd === "-p" ||
    cmd === "--push" ||
    cmd === "--progress-off" ||
    cmd === "--no-alt-screen"
  );
}

function getVersionCheckEnabled(userConfig: UserConfig): boolean {
  return (
    ((userConfig as UserConfig & { versionCheckEnabled?: boolean }).versionCheckEnabled ??
      (userConfig as UserConfig & { commitZero?: { versionCheckEnabled?: boolean } })?.commitZero
        ?.versionCheckEnabled ??
      true) === true
  );
}

function getVersionCheckPeriod(userConfig: UserConfig): "daily" | "weekly" | "monthly" {
  const p =
    (userConfig as UserConfig & { versionCheckPeriod?: string }).versionCheckPeriod ??
    (userConfig as UserConfig & { commitZero?: { versionCheckPeriod?: string } })?.commitZero
      ?.versionCheckPeriod ??
    "daily";
  return p === "weekly" || p === "monthly" ? p : "daily";
}

async function maybePromptUpdate(
  lang: import("../i18n").Lang,
  latestVersion: string
): Promise<void> {
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  if (!isInteractive) return;

  const readline = require("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) => {
    rl.question(
      t(lang, "cli.update_available", { version: latestVersion }) + " ",
      (ans: string) => {
        rl.close();
        resolve(ans);
      }
    );
  });

  if (!isYesAnswer(answer)) {
    console.log(t(lang, "cli.update_declined"));
    return;
  }

  console.log(t(lang, "cli.updating", { version: latestVersion }));
  try {
    const { execFileSync } = require("node:child_process");
    const semverPattern = /^[vV]?(?:\d+\.){2}\d+(?:-[A-Za-z0-9-.]+)?(?:\+[A-Za-z0-9-.]+)?$/;
    const version = (latestVersion || "").trim();
    if (!semverPattern.test(version)) {
      throw new Error(`Unsafe latestVersion: "${version}"`);
    }
    execFileSync(getNpmBin(), ["install", `@codemastersolutions/commitzero@${version}`], {
      stdio: "inherit",
      env: createSafeChildEnv(),
    });
    console.log(t(lang, "cli.update_success", { version: latestVersion }));
    exit(0);
  } catch (e) {
    const status = e && typeof e === "object" ? (e as { status?: unknown }).status : undefined;
    let code = "";
    if (typeof status === "string" || typeof status === "number") {
      code = String(status);
    } else if (status !== undefined) {
      code = inspect(status);
    }
    console.error(t(lang, "cli.update_failed", { code }));
  }
}

async function runVersionCheck(
  lang: import("../i18n").Lang,
  userConfig: UserConfig
): Promise<void> {
  try {
    const upd = await checkForUpdate({
      enabled: getVersionCheckEnabled(userConfig),
      period: getVersionCheckPeriod(userConfig),
      cwd: process.cwd(),
      packageName: "@codemastersolutions/commitzero",
      currentVersion: getCurrentVersion() || "",
    });
    if (upd.shouldPrompt && upd.latestVersion) {
      await maybePromptUpdate(lang, upd.latestVersion);
    }
  } catch {}
}

function printLintErrors(
  lang: import("../i18n").Lang,
  result: { valid: boolean; errors: string[]; warnings: string[] },
  optsUsed: typeof defaultOptions & Partial<UserConfig>
): void {
  console.error(
    c.red(t(lang, "cli.invalid")) + "\n" + result.errors.map((e) => `- ${e}`).join("\n")
  );
  const allowed = (optsUsed.types || defaultOptions.types).join(", ");
  const typeExample = optsUsed.types?.length ? optsUsed.types[0] : defaultOptions.types[0];
  let scopeExample = "";
  if (optsUsed.requireScope || (optsUsed.scopes?.length ?? 0) > 0) {
    const scope = optsUsed.scopes?.length ? optsUsed.scopes[0] : "core";
    scopeExample = `(${scope})`;
  }
  const example = `${typeExample}${scopeExample}: ${t(lang, "cli.exampleSubject")}`;
  console.error("\n" + c.yellow(t(lang, "cli.allowedTypes", { types: allowed })));
  console.error(c.green(t(lang, "cli.exampleValid", { example })));
}

function readLintMessage(args: string[], lang: import("../i18n").Lang): string | null {
  const fileIdx = args.indexOf("--file");
  const msgIdx = args.indexOf("-m");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    return readFileSync(args[fileIdx + 1], "utf8");
  }
  if (msgIdx !== -1 && args[msgIdx + 1]) {
    return args[msgIdx + 1];
  }
  console.error(t(lang, "cli.provideInput"));
  exit(2);
  return null;
}

async function handleInit(args: string[], lang: import("../i18n").Lang): Promise<void> {
  const custom = args.includes("--custom");
  await initConfig(lang, custom);
}

async function handleLint(
  args: string[],
  lang: import("../i18n").Lang,
  userConfig: UserConfig
): Promise<void> {
  const messageRaw = readLintMessage(args, lang);
  if (messageRaw === null) return;
  const message = sanitizeInput(messageRaw);
  const parsed = parseMessage(message);
  const optsUsed = { ...defaultOptions, ...userConfig, language: lang };
  const result = lintCommit(parsed, optsUsed);
  if (!result.valid) {
    printLintErrors(lang, result, optsUsed);
    if (result.warnings.length) {
      console.error(
        "\n" +
          c.yellow(t(lang, "cli.warnings")) +
          "\n" +
          result.warnings.map((w) => `- ${w}`).join("\n")
      );
    }
    exit(1);
    return;
  }
  if (result.warnings.length) {
    console.warn(result.warnings.map((w) => t(lang, "cli.warning", { msg: w })).join("\n"));
  }
  console.log(t(lang, "cli.valid"));
}

function enforceCommitZeroIfConfigured(lang: import("../i18n").Lang, userConfig: UserConfig): void {
  const enforceCommitZero =
    (userConfig as UserConfig & { enforceCommitZero?: boolean }).enforceCommitZero ??
    (userConfig as UserConfig & { commitZero?: { enforceCommitZero?: boolean } })?.commitZero
      ?.enforceCommitZero ??
    false;
  if (!enforceCommitZero) return;
  const isCommitZeroRun =
    process.env.COMMITZERO === "1" ||
    process.env.COMMITZERO === "true" ||
    process.env.COMMITZERO_RUN === "1";
  const allowBypass = process.env.COMMITZERO_ALLOW_GIT_COMMIT === "1";
  if (!isCommitZeroRun && !allowBypass && !isAllowedNonInteractiveGitCommit()) {
    console.error(
      c.red(
        t(lang, "cli.commitzero_required") ||
          "CommitZero is required for commits in this repository."
      )
    );
    console.error(
      c.yellow(
        t(lang, "cli.commitzero_required_hint") ||
          "Use your package script (e.g. `npm run commit`) or `npx commitzero commit`."
      )
    );
    exit(1);
  }
}

async function handleCheck(lang: import("../i18n").Lang, userConfig: UserConfig): Promise<void> {
  try {
    enforceCommitZeroIfConfigured(lang, userConfig);
    const message = readFileSync(".git/COMMIT_EDITMSG", "utf8");
    const parsed = parseMessage(sanitizeInput(message));
    const optsUsed = { ...defaultOptions, ...userConfig, language: lang };
    const result = lintCommit(parsed, optsUsed);
    if (!result.valid) {
      printLintErrors(lang, result, optsUsed);
      exit(1);
    }
  } catch (err) {
    console.error(t(lang, "cli.readEditmsgError"), err);
    exit(2);
  }
}

async function ensureGitInitialized(
  lang: import("../i18n").Lang,
  initGit: boolean
): Promise<boolean> {
  const fs = require("node:fs");
  if (fs.existsSync(".git")) return true;
  if (initGit) {
    require("node:child_process").execFileSync(getGitBin(), ["init"], {
      stdio: "inherit",
      env: createSafeChildEnv(),
    });
    console.log(t(lang, "cli.gitInitialized"));
    return true;
  }
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  if (!isInteractive) {
    console.error(t(lang, "cli.gitNotInitializedError"));
    exit(1);
    return false;
  }
  const readline = require("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(t(lang, "cli.gitNotInitialized"), (a: string) => {
      rl.close();
      resolve(a);
    });
  });
  if (!isYesAnswer(answer)) {
    console.log(t(lang, "cli.gitInitCancelled"));
    return false;
  }
  require("node:child_process").execFileSync(getGitBin(), ["init"], {
    stdio: "inherit",
    env: createSafeChildEnv(),
  });
  console.log(t(lang, "cli.gitInitialized"));
  return true;
}

async function handleInstallHooks(args: string[], lang: import("../i18n").Lang): Promise<void> {
  const initGit = args.includes("--init-git");
  const force = args.includes("--force");
  try {
    const ok = await ensureGitInitialized(lang, initGit);
    if (!ok) return;
    installHooks({ forceOverride: force });
    try {
      ensureScripts(process.cwd());
    } catch {}
    try {
      const path = getCurrentHooksPath() || join(".git", "hooks");
      console.log(t(lang, "cli.hooksInstalled", { path }));
    } catch {
      console.log(t(lang, "cli.hooksInstalled", { path: join(".git", "hooks") }));
    }
  } catch (err: unknown) {
    console.error(
      t(lang, "cli.hooksInstallError", {
        error: formatUnknownError(err),
      })
    );
    exit(1);
  }
}

function handleUninstallHooks(lang: import("../i18n").Lang): void {
  uninstallHooks();
  try {
    cleanupHooks(process.cwd());
  } catch {}
  console.log(t(lang, "cli.hooksRemoved"));
}

function handleCleanup(lang: import("../i18n").Lang): void {
  try {
    cleanupHooks(process.cwd());
  } catch {}
  console.log(t(lang, "cli.hooksRemoved"));
}

async function handleCommit(
  args: string[],
  lang: import("../i18n").Lang,
  userConfig: UserConfig
): Promise<void> {
  const autoAdd = args.includes("-a") || args.includes("--add");
  const autoPush = args.includes("-p") || args.includes("--push");
  const progressOff = args.includes("--progress-off");
  const noAltScreen = args.includes("--no-alt-screen");
  const pushProgressCfg = readNestedBoolean(userConfig, "pushProgress", "pushProgress", true);
  const uiAltScreenCfg = readNestedBoolean(userConfig, "uiAltScreen", "uiAltScreen", true);
  const pushProgress = progressOff ? false : pushProgressCfg;
  const uiAltScreen = noAltScreen ? false : uiAltScreenCfg;
  const tIdx = Math.max(args.indexOf("-t"), args.indexOf("--timeout"));
  const timeoutRaw = tIdx !== -1 && args[tIdx + 1] ? args[tIdx + 1] : undefined;
  const preCommitTimeoutMs = timeoutRaw ? parseTimeToMs(timeoutRaw, 180000) : undefined;
  const cfg: LintOptions & {
    autoAdd?: boolean;
    autoPush?: boolean;
    pushProgress?: boolean;
    uiAltScreen?: boolean;
    preCommitTimeout?: string | number;
  } = { ...defaultOptions, ...userConfig, language: lang };
  const code = await interactiveCommit(lang, {
    ...cfg,
    autoAdd,
    autoPush,
    pushProgress,
    uiAltScreen,
    preCommitTimeout: preCommitTimeoutMs,
  });
  exit(code);
}

function validatePreCommitConfigFile(lang: import("../i18n").Lang): string | null {
  const cwd = process.cwd();
  const jsonPath = join(cwd, "commitzero.config.json");
  const jsPath = join(cwd, "commitzero.config.js");
  if (!existsSync(jsonPath) && existsSync(jsPath)) {
    console.error(t(lang, "cli.preCommitJsConfigUnsupported"));
    exit(2);
    return null;
  }
  return jsonPath;
}

function updatePreCommitCommands(
  lang: import("../i18n").Lang,
  sub: "add" | "remove",
  cmdStr: string
): void {
  const jsonPath = validatePreCommitConfigFile(lang);
  if (!jsonPath) return;
  const current = loadConfig(process.cwd());
  const arr: string[] = Array.isArray(current.preCommitCommands)
    ? [...current.preCommitCommands]
    : [];
  if (sub === "add") {
    if (arr.includes(cmdStr)) {
      console.log(t(lang, "cli.preCommitAlreadyExists", { cmd: cmdStr }));
      return;
    }
    arr.push(cmdStr);
    const nextCfg = { ...current, preCommitCommands: arr };
    writeFileSync(jsonPath, JSON.stringify(nextCfg, null, 2) + "\n", "utf8");
    console.log(t(lang, "cli.preCommitAdded", { cmd: cmdStr }));
    return;
  }
  const idx = arr.indexOf(cmdStr);
  if (idx === -1) {
    console.log(t(lang, "cli.preCommitNotFound", { cmd: cmdStr }));
    exit(1);
    return;
  }
  arr.splice(idx, 1);
  const nextCfg = { ...current, preCommitCommands: arr };
  writeFileSync(jsonPath, JSON.stringify(nextCfg, null, 2) + "\n", "utf8");
  console.log(t(lang, "cli.preCommitRemoved", { cmd: cmdStr }));
}

function validateStagedFileSizes(
  lang: import("../i18n").Lang,
  cfg: LintOptions & UserConfig
): void {
  const maxFileSize = parseSizeToBytes(cfg.maxFileSize ?? 2 * 1024 * 1024);
  try {
    const stagedFiles = require("node:child_process")
      .execFileSync(getGitBin(), ["diff", "--cached", "--name-only"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        cwd: process.cwd(),
        env: createSafeChildEnv(),
      })
      .trim()
      .split("\n")
      .filter((f: string) => f.trim().length > 0);
    for (const file of stagedFiles) {
      const filePath = join(process.cwd(), file);
      if (!existsSync(filePath)) continue;
      const stats = statSync(filePath);
      if (stats.size <= maxFileSize) continue;
      const sizeDisplay = formatBytes(stats.size);
      const limitDisplay = formatBytes(maxFileSize);
      console.error(
        t(lang, "cli.fileSizeLimitExceeded", {
          limit: limitDisplay,
          file,
          size: sizeDisplay,
        })
      );
      exit(1);
      return;
    }
  } catch {}
}

type QuoteChar = "'" | '"';
function isQuoteChar(ch: string): ch is QuoteChar {
  return ch === "'" || ch === '"';
}

function isWhitespaceChar(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n";
}

function isShellMetaChar(ch: string): boolean {
  return ch === "|" || ch === "&" || ch === ";" || ch === ">" || ch === "<";
}

type ParseCommandLineState = {
  args: string[];
  current: string;
  quote: QuoteChar | null;
  escaping: boolean;
  requiresShell: boolean;
};

function pushCurrentArg(state: ParseCommandLineState): void {
  if (state.current.length > 0) state.args.push(state.current);
  state.current = "";
}

function consumeCommandChar(state: ParseCommandLineState, ch: string): void {
  if (state.escaping) {
    state.current += ch;
    state.escaping = false;
    return;
  }

  if (ch === String.fromCodePoint(92)) {
    state.escaping = true;
    return;
  }

  if (state.quote) {
    if (ch === state.quote) {
      state.quote = null;
      return;
    }
    state.current += ch;
    return;
  }

  if (isQuoteChar(ch)) {
    state.quote = ch;
    return;
  }

  if (isWhitespaceChar(ch)) {
    pushCurrentArg(state);
    return;
  }

  if (isShellMetaChar(ch)) {
    state.requiresShell = true;
  }

  state.current += ch;
}

function parseCommandLine(
  command: string
): { file: string; args: string[]; requiresShell: boolean } | null {
  const s = (command ?? "").trim();
  if (!s) return null;

  const state: ParseCommandLineState = {
    args: [],
    current: "",
    quote: null,
    escaping: false,
    requiresShell: false,
  };

  for (const ch of s) {
    consumeCommandChar(state, ch);
  }

  if (state.escaping || state.quote) return null;
  pushCurrentArg(state);
  if (state.args.length === 0) return null;

  return { file: state.args[0], args: state.args.slice(1), requiresShell: state.requiresShell };
}

function isExecutablePath(p: string): boolean {
  if (!p) return false;
  if (!existsSync(p)) return false;
  if (process.platform === "win32") return true;
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

const SAFE_CHILD_PATH =
  process.platform === "win32" ? String.raw`C:\Windows\System32;C:\Windows` : "/usr/bin:/bin";
const TERM_SIGNAL = 15;
const KILL_SIGNAL = 9;
const CHILD_EXIT_EVENT = String.fromCodePoint(101, 120, 105, 116) as "exit";
const CHILD_ERROR_EVENT = String.fromCodePoint(101, 114, 114, 111, 114) as "error";

const SAFE_CHILD_ENV_KEYS =
  process.platform === "win32"
    ? [
        "SYSTEMROOT",
        "SystemRoot",
        "WINDIR",
        "WinDir",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "HOME",
        "HOMEPATH",
        "HOMEDRIVE",
        "USERNAME",
        "COMSPEC",
        "PATHEXT",
        "LANG",
      ]
    : [
        "HOME",
        "USER",
        "LOGNAME",
        "LANG",
        "LC_ALL",
        "LC_CTYPE",
        "TMPDIR",
        "TMP",
        "TEMP",
        "SHELL",
        "TERM",
        "TERM_PROGRAM",
        "TERM_PROGRAM_VERSION",
        "COLORTERM",
      ];

function createSafeChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of SAFE_CHILD_ENV_KEYS) {
    const v = process.env[key];
    if (typeof v === "string") env[key] = v;
  }
  env.PATH = SAFE_CHILD_PATH;
  if (process.platform === "win32") env.Path = SAFE_CHILD_PATH;
  return env;
}

function resolveAllowedAliasExecutable(lower: string): string | null {
  if (lower === "node" || lower === "node.exe") return process.execPath;
  if (lower === "npm" || lower === "npm.exe" || lower === "npm.cmd") return getNpmBin();
  if (lower === "git" || lower === "git.exe") return getGitBin();
  return null;
}

function resolveWindowsSystemExecutable(name: string): string | null {
  const sys32 = String.raw`C:\Windows\System32`;
  const win = String.raw`C:\Windows`;
  const suffixes = ["", ".exe", ".cmd", ".bat"];
  for (const suf of suffixes) {
    const fileName = `${name}${suf}`;
    const candidate1 = join(sys32, fileName);
    if (isExecutablePath(candidate1)) return candidate1;
    const candidate2 = join(win, fileName);
    if (isExecutablePath(candidate2)) return candidate2;
  }
  return null;
}

function resolveUnixSystemExecutable(name: string): string | null {
  for (const base of ["/usr/bin", "/bin"]) {
    const candidate = join(base, name);
    if (isExecutablePath(candidate)) return candidate;
  }
  return null;
}

function resolvePreCommitExecutable(file: string): string | null {
  const f = (file ?? "").trim();
  if (!f) return null;

  const lower = f.toLowerCase();
  if (isAbsolute(f)) return isExecutablePath(f) ? f : null;
  const alias = resolveAllowedAliasExecutable(lower);
  if (alias) return alias;
  return process.platform === "win32"
    ? resolveWindowsSystemExecutable(f)
    : resolveUnixSystemExecutable(f);
}

async function runPreCommitCommands(
  lang: import("../i18n").Lang,
  commands: string[],
  timeoutMs: number
): Promise<void> {
  const durations: { cmd: string; timeMs: number }[] = [];
  for (const command of commands) {
    const parsed = parseCommandLine(command);
    if (!parsed) {
      console.error(`Invalid pre-commit command: ${command}`);
      exit(1);
      return;
    }
    if (parsed.requiresShell) {
      console.error(`Pre-commit command requires a shell and is not allowed: ${command}`);
      exit(1);
      return;
    }

    console.log(t(lang, "cli.preCommitRun", { cmd: command }));
    const startTs = Date.now();
    const execPath = resolvePreCommitExecutable(parsed.file);
    if (!execPath) {
      console.error(`Pre-commit command is not allowed (requires absolute path): ${command}`);
      exit(1);
      return;
    }

    const child = require("node:child_process").spawn(execPath, parsed.args, {
      cwd: process.cwd(),
      stdio: ["ignore", "inherit", "inherit"],
      env: createSafeChildEnv(),
    });
    let timedOut = false;
    const progress = setInterval(() => {
      const elapsed = Date.now() - startTs;
      process.stdout.write(
        "\r" +
          t(lang, "cli.preCommitRun", { cmd: command }) +
          " — " +
          t(lang, "cli.preCommitElapsed", { time: formatDurationMs(elapsed) })
      );
    }, 1000);
    const killer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill(TERM_SIGNAL);
        setTimeout(() => {
          try {
            child.kill(KILL_SIGNAL);
          } catch {}
        }, 1000);
      } catch {}
    }, timeoutMs);

    const rc: number = await new Promise((resolve) => {
      child.on(CHILD_EXIT_EVENT, (code: number | null) =>
        resolve(typeof code === "number" ? code : 1)
      );
      child.on(CHILD_ERROR_EVENT, () => resolve(1));
    });

    clearTimeout(killer);
    clearInterval(progress);
    process.stdout.write("\n");
    const elapsedTotal = Date.now() - startTs;
    durations.push({ cmd: command, timeMs: elapsedTotal });
    if (timedOut) {
      console.error(
        t(lang, "cli.preCommitTimeout", { cmd: command, time: formatDurationMs(timeoutMs) })
      );
      exit(1);
      return;
    }
    if (rc !== 0) {
      console.error(t(lang, "cli.preCommitFail", { cmd: command }));
      exit(1);
      return;
    }
  }

  console.log(t(lang, "cli.preCommitSummary"));
  for (const d of durations) {
    console.log(
      t(lang, "cli.preCommitSummaryItem", { cmd: d.cmd, time: formatDurationMs(d.timeMs) })
    );
  }
  const totalMs = durations.reduce((acc, d) => acc + d.timeMs, 0);
  console.log(t(lang, "cli.preCommitSummaryTotal", { time: formatDurationMs(totalMs) }));
  console.log(t(lang, "cli.preCommitOk"));
}

async function handlePreCommit(
  args: string[],
  lang: import("../i18n").Lang,
  userConfig: UserConfig
): Promise<void> {
  const sub = args[1];
  if (sub === "add" || sub === "remove") {
    const cmdStr = args.slice(2).join(" ");
    if (!cmdStr.trim()) {
      console.error(t(lang, "cli.preCommitProvideCmd"));
      exit(2);
      return;
    }
    updatePreCommitCommands(lang, sub, cmdStr);
    return;
  }

  const cfg = { ...defaultOptions, ...userConfig, language: lang };
  validateStagedFileSizes(lang, cfg as LintOptions & UserConfig);

  const commands: string[] = Array.isArray(cfg.preCommitCommands) ? cfg.preCommitCommands : [];
  if (!commands.length) {
    console.log(t(lang, "cli.preCommitNone"));
    return;
  }
  console.log(t(lang, "cli.preCommitStart", { count: commands.length }));
  const envTimeoutRaw = process.env.COMMITZERO_PRE_COMMIT_TIMEOUT;
  const cfgTimeoutRaw = readNestedValue<string | number>(
    userConfig,
    "preCommitTimeout",
    "preCommitTimeout"
  );
  const timeoutMs = parseTimeToMs(envTimeoutRaw ?? cfgTimeoutRaw, 180000);
  await runPreCommitCommands(lang, commands, timeoutMs);
}

async function main() {
  const args = argv.slice(2);
  const userConfig = loadConfig();
  const lang = userConfig.language ?? DEFAULT_LANG;
  if (args.includes("--help") || args.length === 0) {
    printHelp(lang);
    return;
  }

  const cmd = args[0];
  await runVersionCheck(lang, userConfig);

  if (isFlagsOnlyCommand(cmd)) {
    console.error(c.red(t(lang, "cli.flagsOnlyWithCommit")));
    printHelp(lang);
    exit(2);
    return;
  }

  if (cmd === "init") return handleInit(args, lang);
  if (cmd === "lint") return handleLint(args, lang, userConfig);
  if (cmd === "check") return handleCheck(lang, userConfig);
  if (cmd === "install-hooks") return handleInstallHooks(args, lang);
  if (cmd === "uninstall-hooks") return handleUninstallHooks(lang);
  if (cmd === "cleanup") return handleCleanup(lang);
  if (cmd === "commit") return handleCommit(args, lang, userConfig);
  if (cmd === "pre-commit") return handlePreCommit(args, lang, userConfig);

  printHelp(lang);
}

try {
  await main();
} catch (err) {
  console.error(formatUnknownError(err));
  exit(2);
}

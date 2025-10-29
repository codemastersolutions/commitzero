#!/usr/bin/env node
/* eslint-disable no-control-regex */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { argv, exit } from "node:process";
import { loadConfig, type UserConfig } from "../config/load.js";
import { parseMessage } from "../core/parser";
import { defaultOptions, lintCommit, type LintOptions } from "../core/rules";
import { cleanupHooks } from "../hooks/cleanup";
import { installHooks, uninstallHooks, getCurrentHooksPath, isCommitZeroHooksPath } from "../hooks/install";
import { DEFAULT_LANG, t } from "../i18n/index.js";
import { c } from "./colors";
import { interactiveCommit } from "./commands/commit";
import { initConfig } from "./commands/init";

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
  return s.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
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

  if (
    cmd === "-a" ||
    cmd === "--add" ||
    cmd === "-p" ||
    cmd === "--push" ||
    cmd === "--progress-off"
  ) {
    console.error(c.red(t(lang, "cli.flagsOnlyWithCommit")));
    printHelp(lang);
    exit(2);
    return;
  }

  if (cmd === "init") {
    await initConfig(lang);
    return;
  }
  if (cmd === "lint") {
    const fileIdx = args.indexOf("--file");
    const msgIdx = args.indexOf("-m");
    let message = "";
    if (fileIdx !== -1 && args[fileIdx + 1]) {
      message = readFileSync(args[fileIdx + 1], "utf8");
    } else if (msgIdx !== -1 && args[msgIdx + 1]) {
      message = args[msgIdx + 1];
    } else {
      console.error(t(lang, "cli.provideInput"));
      exit(2);
    }
    message = sanitizeInput(message);
    const parsed = parseMessage(message);
    const optsUsed = { ...defaultOptions, ...userConfig, language: lang };
    const result = lintCommit(parsed, optsUsed);
    if (!result.valid) {
      console.error(
        c.red(t(lang, "cli.invalid")) + "\n" + result.errors.map((e) => `- ${e}`).join("\n")
      );
      const allowed = (optsUsed.types || defaultOptions.types).join(", ");
      const typeExample =
        optsUsed.types && optsUsed.types.length ? optsUsed.types[0] : defaultOptions.types[0];
      const scopeExample =
        optsUsed.requireScope || (optsUsed.scopes && optsUsed.scopes.length)
          ? `(${optsUsed.scopes && optsUsed.scopes.length ? optsUsed.scopes[0] : "core"})`
          : "";
      const example = `${typeExample}${scopeExample}: ${t(lang, "cli.exampleSubject")}`;
      console.error("\n" + c.yellow(t(lang, "cli.allowedTypes", { types: allowed })));
      console.error(c.green(t(lang, "cli.exampleValid", { example })));
      if (result.warnings.length) {
        console.error(
          "\n" +
            c.yellow(t(lang, "cli.warnings")) +
            "\n" +
            result.warnings.map((w) => `- ${w}`).join("\n")
        );
      }
      exit(1);
    } else {
      if (result.warnings.length) {
        console.warn(result.warnings.map((w) => t(lang, "cli.warning", { msg: w })).join("\n"));
      }
      console.log(t(lang, "cli.valid"));
    }
    return;
  }

  if (cmd === "check") {
    // Usado pelo hook commit-msg
    try {
      const message = readFileSync(".git/COMMIT_EDITMSG", "utf8");
      const parsed = parseMessage(sanitizeInput(message));
      const optsUsed = { ...defaultOptions, ...userConfig, language: lang };
      const result = lintCommit(parsed, optsUsed);
      if (!result.valid) {
        console.error(
          c.red(t(lang, "cli.invalid")) + "\n" + result.errors.map((e) => `- ${e}`).join("\n")
        );
        const allowed = (optsUsed.types || defaultOptions.types).join(", ");
        const typeExample =
          optsUsed.types && optsUsed.types.length ? optsUsed.types[0] : defaultOptions.types[0];
        const scopeExample =
          optsUsed.requireScope || (optsUsed.scopes && optsUsed.scopes.length)
            ? `(${optsUsed.scopes && optsUsed.scopes.length ? optsUsed.scopes[0] : "core"})`
            : "";
        const example = `${typeExample}${scopeExample}: ${t(lang, "cli.exampleSubject")}`;
        console.error("\n" + c.yellow(t(lang, "cli.allowedTypes", { types: allowed })));
        console.error(c.green(t(lang, "cli.exampleValid", { example })));
        exit(1);
      }
      return;
    } catch (err) {
      console.error(t(lang, "cli.readEditmsgError"), err);
      exit(2);
    }
  }

  if (cmd === "install-hooks") {
    const forceOverride = args.includes("--force");
    const initGit = args.includes("--init-git");
    
    try {
      // Check if git is initialized
      if (!require("node:fs").existsSync(".git") && !initGit) {
        const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
        if (isInteractive) {
          const readline = require("node:readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const answer = await new Promise<string>((resolve) => {
            rl.question(t(lang, "cli.gitNotInitialized"), (answer: string) => {
              rl.close();
              resolve(answer.toLowerCase());
            });
          });
          
          if (answer === "y" || answer === "yes" || answer === "s" || answer === "sim" || answer === "sí") {
            require("node:child_process").execSync("git init", { stdio: "inherit" });
            console.log(t(lang, "cli.gitInitialized"));
          } else {
            console.log(t(lang, "cli.gitInitCancelled"));
            return;
          }
        } else {
          console.error(t(lang, "cli.gitNotInitializedError"));
          exit(1);
          return;
        }
      } else if (!require("node:fs").existsSync(".git") && initGit) {
        require("node:child_process").execSync("git init", { stdio: "inherit" });
        console.log(t(lang, "cli.gitInitialized"));
      }
      
      // Check for existing hooks path and handle override
      const currentHooksPath = getCurrentHooksPath();
      
      if (currentHooksPath && !isCommitZeroHooksPath(currentHooksPath) && !forceOverride) {
        const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
        if (isInteractive) {
          const readline = require("node:readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          console.log(t(lang, "cli.hooksPathExists", { path: currentHooksPath }));
          const answer = await new Promise<string>((resolve) => {
            rl.question(t(lang, "cli.overrideHooksPath"), (answer: string) => {
              rl.close();
              resolve(answer.toLowerCase());
            });
          });
          
          if (answer !== "y" && answer !== "yes" && answer !== "s" && answer !== "sim" && answer !== "sí") {
            console.log(t(lang, "cli.hooksInstallCancelled"));
            return;
          }
        } else {
          console.error(t(lang, "cli.hooksPathExistsError", { path: currentHooksPath }));
          exit(1);
          return;
        }
      }
      
      installHooks({ forceOverride });
      console.log(t(lang, "cli.hooksInstalled"));
    } catch (err: any) {
      console.error(t(lang, "cli.hooksInstallError", { error: err.message }));
      exit(1);
    }
    return;
  }

  if (cmd === "uninstall-hooks") {
    uninstallHooks();
    try {
      cleanupHooks(process.cwd());
    } catch {}
    console.log(t(lang, "cli.hooksRemoved"));
    return;
  }

  if (cmd === "cleanup") {
    try {
      cleanupHooks(process.cwd());
    } catch {}
    console.log(t(lang, "cli.hooksRemoved"));
    return;
  }

  if (cmd === "commit") {
    const cfg: LintOptions & { autoAdd?: boolean; autoPush?: boolean; pushProgress?: boolean } = { 
      ...defaultOptions, 
      ...userConfig, 
      language: lang 
    };

    const autoAdd = args.includes("-a") || args.includes("--add");
    const autoPush = args.includes("-p") || args.includes("--push");
    const progressOff = args.includes("--progress-off");
    const nestedPushProgress = (userConfig as UserConfig & { commitZero?: { pushProgress?: boolean } })?.commitZero?.pushProgress;
    const pushProgressCfg =
      typeof (userConfig as UserConfig & { pushProgress?: boolean }).pushProgress === "boolean"
        ? (userConfig as UserConfig & { pushProgress?: boolean }).pushProgress
        : typeof nestedPushProgress === "boolean"
          ? nestedPushProgress
          : true;
    const pushProgress = progressOff ? false : pushProgressCfg;
    const code = await interactiveCommit(lang, { ...cfg, autoAdd, autoPush, pushProgress });
    exit(code);
  }

  if (cmd === "pre-commit") {
    const sub = args[1];
    if (sub === "add" || sub === "remove") {
      const cmdStr = args.slice(2).join(" ");
      if (!cmdStr.trim()) {
        console.error(t(lang, "cli.preCommitProvideCmd"));
        exit(2);
        return;
      }
      const cwd = process.cwd();
      const jsonPath = join(cwd, "commitzero.config.json");
      const jsPath = join(cwd, "commitzero.config.js");
      if (!existsSync(jsonPath) && existsSync(jsPath)) {
        console.error(t(lang, "cli.preCommitJsConfigUnsupported"));
        exit(2);
        return;
      }
      const current = loadConfig(cwd);
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
      } else {
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
        return;
      }
    }

    const cfg = { ...defaultOptions, ...userConfig, language: lang };
    const commands: string[] = Array.isArray(cfg.preCommitCommands) ? cfg.preCommitCommands : [];
    if (!commands.length) {
      console.log(t(lang, "cli.preCommitNone"));
      return;
    }
    for (const command of commands) {
      try {
        console.log(t(lang, "cli.preCommitRun", { cmd: command }));

        const out = require("node:child_process").execSync(command, {
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf8",
          cwd: process.cwd(),
        });
        if (out) process.stdout.write(out);
      } catch (err: unknown) {
        const errOut = err && err instanceof Error ? err.message : "";
        if (errOut) process.stderr.write(errOut);
        console.error(t(lang, "cli.preCommitFail", { cmd: command }));
        exit(1);
      }
    }
    console.log(t(lang, "cli.preCommitOk"));
    return;
  }

  printHelp(lang);
}

main()
  .catch((err) => {
    console.error(err);
    exit(2);
  })
  .finally(() => {
    // Removido pause global em stdin: cada comando interativo faz seu próprio cleanup.
    // Manter vazio para não encerrar sessões interativas antes da conclusão.
  });
// Modified for testing
// Teste para verificar mensagem commit.git.added// Teste final// Debug translation// Nova mudança
// Debug test - modificação para testar commit --add
// Debug: Verificando se commit.git.added está sendo traduzido corretamente - teste 3

#!/usr/bin/env node
import { parseMessage } from "../core/parser";
import { lintCommit, defaultOptions } from "../core/rules";
import { installHooks, uninstallHooks } from "../hooks/install";
import { interactiveCommit } from "./commands/commit";
import { initConfig } from "./commands/init";
import { loadConfig } from "../config/load";
import { t, DEFAULT_LANG } from "../i18n/index.js";
import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";
import { c } from "./colors";

function printHelp(lang: import("../i18n").Lang) {
  console.log(t(lang, "cli.help"));
}

function sanitizeInput(s: string): string {
  // Remover caracteres de controle, preservando tabs e quebras de linha
  // Não alterar espaços para manter estrutura header/body/footer
  return s.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "");
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
  // Guard: flags -a/--add and -p/--push only valid with 'commit' subcommand
  if (cmd === "-a" || cmd === "--add" || cmd === "-p" || cmd === "--push") {
    console.error(c.red(t(lang, "cli.flagsOnlyWithCommit")));
    printHelp(lang);
    exit(2);
    return;
  }
  // userConfig already loaded

  if (cmd === "init") {
    initConfig(lang);
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
      console.error(c.red(t(lang, "cli.invalid")) + "\n" + result.errors.map(e => `- ${e}`).join("\n"));
      const allowed = (optsUsed.types || defaultOptions.types).join(", ");
      const typeExample = (optsUsed.types && optsUsed.types.length ? optsUsed.types[0] : defaultOptions.types[0]);
      const scopeExample = (optsUsed.requireScope || (optsUsed.scopes && optsUsed.scopes.length))
        ? `(${(optsUsed.scopes && optsUsed.scopes.length ? optsUsed.scopes[0] : "core")})`
        : "";
      const example = `${typeExample}${scopeExample}: ${t(lang, "cli.exampleSubject")}`;
      console.error("\n" + c.yellow(t(lang, "cli.allowedTypes", { types: allowed })));
      console.error(c.green(t(lang, "cli.exampleValid", { example })));
      if (result.warnings.length) {
        console.error("\n" + c.yellow(t(lang, "cli.warnings")) + "\n" + result.warnings.map(w => `- ${w}`).join("\n"));
      }
      exit(1);
    } else {
      if (result.warnings.length) {
        console.warn(result.warnings.map(w => t(lang, "cli.warning", { msg: w })).join("\n"));
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
        console.error(c.red(t(lang, "cli.invalid")) + "\n" + result.errors.map(e => `- ${e}`).join("\n"));
        const allowed = (optsUsed.types || defaultOptions.types).join(", ");
        const typeExample = (optsUsed.types && optsUsed.types.length ? optsUsed.types[0] : defaultOptions.types[0]);
        const scopeExample = (optsUsed.requireScope || (optsUsed.scopes && optsUsed.scopes.length))
          ? `(${(optsUsed.scopes && optsUsed.scopes.length ? optsUsed.scopes[0] : "core")})`
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
    installHooks();
    console.log(t(lang, "cli.hooksInstalled"));
    return;
  }

  if (cmd === "uninstall-hooks") {
    uninstallHooks();
    console.log(t(lang, "cli.hooksRemoved"));
    return;
  }

  if (cmd === "commit") {
    const cfg = { ...defaultOptions, ...userConfig, language: lang };
    // Parse flags: -a/--add and -p/--push
    const autoAdd = args.includes("-a") || args.includes("--add");
    const autoPush = args.includes("-p") || args.includes("--push");
    interactiveCommit(lang, { ...cfg, autoAdd: autoAdd as any, autoPush: autoPush as any }).then(code => exit(code));
    return;
  }

  printHelp(lang);
}

main().catch(err => {
  console.error(err);
  exit(2);
});
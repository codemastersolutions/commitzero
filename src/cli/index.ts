#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { argv, exit } from "node:process";
import { loadConfig } from "../config/load";
import { join } from "node:path";
import { parseMessage } from "../core/parser";
import { defaultOptions, lintCommit } from "../core/rules";
import { installHooks, uninstallHooks } from "../hooks/install";
import { cleanupHooks } from "../hooks/cleanup";
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
      const pkgPath2 = require.resolve(
        "@codemastersolutions/commitzero/package.json"
      );
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
  // Remover caracteres de controle, preservando tabs e quebras de linha
  // Não alterar espaços para manter estrutura header/body/footer
  // eslint-disable-next-line no-control-regex
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
  // Guard: flags -a/--add and -p/--push only valid with 'commit' subcommand
  if (cmd === "-a" || cmd === "--add" || cmd === "-p" || cmd === "--push") {
    console.error(c.red(t(lang, "cli.flagsOnlyWithCommit")));
    printHelp(lang);
    exit(2);
    return;
  }
  // userConfig already loaded

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
        c.red(t(lang, "cli.invalid")) +
          "\n" +
          result.errors.map((e) => `- ${e}`).join("\n")
      );
      const allowed = (optsUsed.types || defaultOptions.types).join(", ");
      const typeExample =
        optsUsed.types && optsUsed.types.length
          ? optsUsed.types[0]
          : defaultOptions.types[0];
      const scopeExample =
        optsUsed.requireScope || (optsUsed.scopes && optsUsed.scopes.length)
          ? `(${
              optsUsed.scopes && optsUsed.scopes.length
                ? optsUsed.scopes[0]
                : "core"
            })`
          : "";
      const example = `${typeExample}${scopeExample}: ${t(
        lang,
        "cli.exampleSubject"
      )}`;
      console.error(
        "\n" + c.yellow(t(lang, "cli.allowedTypes", { types: allowed }))
      );
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
        console.warn(
          result.warnings
            .map((w) => t(lang, "cli.warning", { msg: w }))
            .join("\n")
        );
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
          c.red(t(lang, "cli.invalid")) +
            "\n" +
            result.errors.map((e) => `- ${e}`).join("\n")
        );
        const allowed = (optsUsed.types || defaultOptions.types).join(", ");
        const typeExample =
          optsUsed.types && optsUsed.types.length
            ? optsUsed.types[0]
            : defaultOptions.types[0];
        const scopeExample =
          optsUsed.requireScope || (optsUsed.scopes && optsUsed.scopes.length)
            ? `(${
                optsUsed.scopes && optsUsed.scopes.length
                  ? optsUsed.scopes[0]
                  : "core"
              })`
            : "";
        const example = `${typeExample}${scopeExample}: ${t(
          lang,
          "cli.exampleSubject"
        )}`;
        console.error(
          "\n" + c.yellow(t(lang, "cli.allowedTypes", { types: allowed }))
        );
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
    try { cleanupHooks(process.cwd()); } catch {}
    console.log(t(lang, "cli.hooksRemoved"));
    return;
  }

  if (cmd === "cleanup") {
    // Manually remove CommitZero managed blocks from Git hooks
    try { cleanupHooks(process.cwd()); } catch {}
    console.log(t(lang, "cli.hooksRemoved"));
    return;
  }

  if (cmd === "commit") {
    const cfg = { ...defaultOptions, ...userConfig, language: lang };
    // Parse flags: -a/--add and -p/--push
    const autoAdd = args.includes("-a") || args.includes("--add");
    const autoPush = args.includes("-p") || args.includes("--push");
    interactiveCommit(lang, { ...cfg, autoAdd, autoPush }).then((code) =>
      exit(code)
    );
    return;
  }

  if (cmd === "pre-commit") {
    // Manage or run pre-commit commands
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
    // Execute configured pre-commit commands sequentially; stop on first failure
    const cfg = { ...defaultOptions, ...userConfig, language: lang } as any;
    const commands: string[] = Array.isArray(cfg.preCommitCommands)
      ? cfg.preCommitCommands
      : [];
    if (!commands.length) {
      console.log(t(lang, "cli.preCommitNone"));
      return;
    }
    for (const command of commands) {
      try {
        console.log(t(lang, "cli.preCommitRun", { cmd: command }));
        // Capture output to avoid leaking inherited stdio into parent test runner
        const out = require("node:child_process").execSync(command, {
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf8",
          cwd: process.cwd(),
        });
        if (out) process.stdout.write(out);
      } catch (err: any) {
        const errOut = err && err.stderr ? String(err.stderr) : "";
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
    try { (process.stdin as any).pause?.(); } catch {}
  });

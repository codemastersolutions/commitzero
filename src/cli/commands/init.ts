import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline";
import { DEFAULT_LANG, t, type Lang } from "../../i18n/index.js";
import { type UserConfig } from "../../config/load.js";
import { c } from "../colors.js";

function askWithValidation(
  rl: readline.Interface,
  q: string,
  validator?: (answer: string) => boolean | string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const onSigint = () => {
      rl.removeListener("SIGINT", onSigint);
      reject(new Error("cancelled"));
    };

    const askQuestion = () => {
      rl.once("SIGINT", onSigint);
      rl.question(q, (answer: string) => {
        rl.removeListener("SIGINT", onSigint);
        const trimmedAnswer = answer.trim();

        if (validator) {
          const validationResult = validator(trimmedAnswer);
          if (validationResult !== true) {
            const errorMessage =
              typeof validationResult === "string" ? validationResult : "Invalid input";
            console.log(c.red(errorMessage));
            askQuestion();
            return;
          }
        }

        resolve(trimmedAnswer);
      });
    };

    askQuestion();
  });
}

function addToGitignore(fileName: string) {
  const gitignorePath = ".gitignore";
  let content = "";
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, "utf8");
  }
  const normalizedLines = new Set(
    content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
  );
  const alreadyIgnored =
    normalizedLines.has(fileName) ||
    normalizedLines.has(`/${fileName}`) ||
    normalizedLines.has(`./${fileName}`) ||
    normalizedLines.has(`**/${fileName}`);

  if (!alreadyIgnored) {
    if (content && !content.endsWith("\n")) {
      content += "\n";
    }
    content += `${fileName}\n`;
    writeFileSync(gitignorePath, content, "utf8");
  }
}

function isLang(v: unknown): v is Lang {
  return v === "en" || v === "pt" || v === "es";
}

function readLanguageFromJsonConfig(path: string): Lang | undefined {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as { language?: unknown };
    if (isLang(parsed?.language)) return parsed.language;
  } catch {}
  return undefined;
}

function isCancelledError(err: unknown): boolean {
  return err instanceof Error && err.message === "cancelled";
}

function createYesNoValidator(lang: Lang): (answer: string) => boolean | string {
  return (answer: string) => {
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

function isYes(answer: string): boolean {
  return /^y(es)?$/i.test(answer);
}

async function confirmOverwriteIfExists(
  existed: boolean,
  promptLang: Lang,
  existsKey: string,
  askOverwriteKey: string,
  willOverwriteKey: string,
  confirmOverwriteKey: string
): Promise<boolean> {
  if (!existed) return true;
  const isTTY = !!input.isTTY;
  if (!isTTY) {
    console.log(t(promptLang, existsKey));
    return false;
  }

  let rl: readline.Interface | null = null;
  try {
    rl = readline.createInterface({ input, output });
    const yesNoValidator = createYesNoValidator(promptLang);
    const ans = await askWithValidation(rl, c.cyan(t(promptLang, askOverwriteKey)), yesNoValidator);
    if (!isYes(ans)) {
      console.log(c.yellow(t(promptLang, "init.cancelled")));
      return false;
    }
    console.log(c.yellow(t(promptLang, willOverwriteKey)));
    const confirm = await askWithValidation(
      rl,
      c.cyan(t(promptLang, confirmOverwriteKey)),
      yesNoValidator
    );
    if (!isYes(confirm)) {
      console.log(c.yellow(t(promptLang, "init.cancelled")));
      return false;
    }
    return true;
  } catch (err) {
    if (isCancelledError(err)) {
      console.log(c.yellow(t(promptLang, "init.cancelled")));
      return false;
    }
    console.log(c.yellow(t(promptLang, "init.cancelled")));
    return false;
  } finally {
    rl?.close();
    try {
      input.pause?.();
    } catch {}
  }
}

async function resolveTemplate(
  custom: boolean,
  promptLang: Lang,
  defaultsLang: Lang,
  normalConfigPath: string
): Promise<UserConfig> {
  if (!custom || !existsSync(normalConfigPath)) {
    return buildDefaultConfig(defaultsLang);
  }

  const isTTY = !!input.isTTY;
  if (!isTTY) {
    return buildDefaultConfig(defaultsLang);
  }

  let rl: readline.Interface | null = null;
  try {
    rl = readline.createInterface({ input, output });
    const yesNoValidator = createYesNoValidator(promptLang);
    const ans = await askWithValidation(
      rl,
      c.cyan(t(promptLang, "init.askCustomCopyFromNormal")),
      yesNoValidator
    );
    if (isYes(ans)) {
      const normalConfig = readFileSync(normalConfigPath, "utf8");
      return JSON.parse(normalConfig) as UserConfig;
    }
    return buildDefaultConfig(defaultsLang);
  } finally {
    rl?.close();
    try {
      input.pause?.();
    } catch {}
  }
}

function buildDefaultConfig(lang: Lang): UserConfig {
  return {
    types: [
      "feat",
      "fix",
      "docs",
      "style",
      "refactor",
      "perf",
      "test",
      "build",
      "ci",
      "chore",
      "revert",
    ],
    scopes: [],
    requireScope: false,
    maxSubjectLength: 72,
    maxFileSize: "2MB",
    allowBreaking: true,
    footerKeywords: ["BREAKING CHANGE", "Closes", "Refs"],
    preCommitCommands: [],
    preCommitTimeout: "3m",
    versionCheckEnabled: true,
    versionCheckPeriod: "daily",
    language: lang,
    uiAltScreen: true,
  };
}

function buildInitContext(custom: boolean, lang: Lang) {
  const configPath = custom ? "commitzero.config.custom.json" : "commitzero.config.json";
  const normalConfigPath = "commitzero.config.json";
  const existed = existsSync(configPath);

  const promptLang = custom
    ? (readLanguageFromJsonConfig(normalConfigPath) ?? DEFAULT_LANG)
    : (readLanguageFromJsonConfig(configPath) ?? lang ?? DEFAULT_LANG);

  let defaultsLang: Lang;
  if (custom || existed) defaultsLang = DEFAULT_LANG;
  else defaultsLang = lang ?? DEFAULT_LANG;

  return {
    configPath,
    normalConfigPath,
    existed,
    promptLang,
    defaultsLang,
    keys: {
      existsKey: custom ? "init.custom.exists" : "init.exists",
      createdKey: custom ? "init.custom.created" : "init.created",
      askOverwriteKey: custom ? "init.custom.askOverwrite" : "init.askOverwrite",
      willOverwriteKey: custom ? "init.custom.willOverwrite" : "init.willOverwrite",
      confirmOverwriteKey: custom ? "init.custom.confirmOverwrite" : "init.confirmOverwrite",
      overwrittenKey: custom ? "init.custom.overwritten" : "init.overwritten",
    },
  };
}

function printInitResult(
  existed: boolean,
  promptLang: Lang,
  createdKey: string,
  overwrittenKey: string
) {
  if (existed) {
    console.log(c.green(t(promptLang, overwrittenKey)));
    return;
  }
  console.log(t(promptLang, createdKey));
}

export async function initConfig(
  lang: import("../../i18n").Lang = DEFAULT_LANG,
  custom: boolean = false
) {
  const ctx = buildInitContext(custom, lang);

  const canContinue = await confirmOverwriteIfExists(
    ctx.existed,
    ctx.promptLang,
    ctx.keys.existsKey,
    ctx.keys.askOverwriteKey,
    ctx.keys.willOverwriteKey,
    ctx.keys.confirmOverwriteKey
  );
  if (!canContinue) return;

  let tpl: UserConfig;
  try {
    tpl = await resolveTemplate(custom, ctx.promptLang, ctx.defaultsLang, ctx.normalConfigPath);
  } catch (err) {
    if (isCancelledError(err)) {
      console.log(c.yellow(t(ctx.promptLang, "init.cancelled")));
      return;
    }
    tpl = buildDefaultConfig(ctx.defaultsLang);
  }

  writeFileSync(ctx.configPath, JSON.stringify(tpl, null, 2) + "\n", "utf8");

  if (custom) {
    addToGitignore("commitzero.config.custom.json");
  }

  printInitResult(ctx.existed, ctx.promptLang, ctx.keys.createdKey, ctx.keys.overwrittenKey);
}

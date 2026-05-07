import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline";
import { DEFAULT_LANG, t, type Lang } from "../../i18n/index.js";
import { type UserConfig } from "../../config/load.js";
import { c } from "../colors";

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
  const lines = content.split(/\r?\n/);
  if (!lines.includes(fileName)) {
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

export async function initConfig(
  lang: import("../../i18n").Lang = DEFAULT_LANG,
  custom: boolean = false
) {
  const configPath = custom ? "commitzero.config.custom.json" : "commitzero.config.json";
  const normalConfigPath = "commitzero.config.json";
  const existed = existsSync(configPath);
  const promptLang = custom
    ? (readLanguageFromJsonConfig(normalConfigPath) ?? DEFAULT_LANG)
    : (readLanguageFromJsonConfig(configPath) ?? lang ?? DEFAULT_LANG);
  const defaultsLang = custom ? DEFAULT_LANG : existed ? DEFAULT_LANG : (lang ?? DEFAULT_LANG);
  const existsKey = custom ? "init.custom.exists" : "init.exists";
  const createdKey = custom ? "init.custom.created" : "init.created";
  const askOverwriteKey = custom ? "init.custom.askOverwrite" : "init.askOverwrite";
  const willOverwriteKey = custom ? "init.custom.willOverwrite" : "init.willOverwrite";
  const confirmOverwriteKey = custom ? "init.custom.confirmOverwrite" : "init.confirmOverwrite";
  const overwrittenKey = custom ? "init.custom.overwritten" : "init.overwritten";

  if (existed) {
    const isTTY = !!input.isTTY;
    if (!isTTY) {
      console.log(t(promptLang, existsKey));
      return;
    }
    let rl: readline.Interface | null = null;
    try {
      rl = readline.createInterface({ input, output });

      const yesNoValidator = (answer: string): boolean | string => {
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
        return t(promptLang, "commit.validation.yesNo") || "Please answer with 'y' or 'n'";
      };

      const ans = await askWithValidation(
        rl,
        c.cyan(t(promptLang, askOverwriteKey)),
        yesNoValidator
      );
      const yes = /^y(es)?$/i.test(ans);
      if (!yes) {
        console.log(c.yellow(t(promptLang, "init.cancelled")));
        return;
      }
      console.log(c.yellow(t(promptLang, willOverwriteKey)));
      const confirm = await askWithValidation(
        rl,
        c.cyan(t(promptLang, confirmOverwriteKey)),
        yesNoValidator
      );
      const confirmed = /^y(es)?$/i.test(confirm);
      if (!confirmed) {
        console.log(c.yellow(t(promptLang, "init.cancelled")));
        return;
      }
    } catch (err) {
      if (isCancelledError(err)) {
        console.log(c.yellow(t(promptLang, "init.cancelled")));
        return;
      }
      console.log(c.yellow(t(promptLang, "init.cancelled")));
      return;
    } finally {
      rl?.close();
      try {
        input.pause?.();
      } catch {}
    }
  }

  let tpl: UserConfig | undefined;
  if (custom && existsSync(normalConfigPath)) {
    const isTTY = !!input.isTTY;
    if (isTTY) {
      let rl: readline.Interface | null = null;
      try {
        rl = readline.createInterface({ input, output });

        const yesNoValidator = (answer: string): boolean | string => {
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
          return t(promptLang, "commit.validation.yesNo") || "Please answer with 'y' or 'n'";
        };

        const ans = await askWithValidation(
          rl,
          c.cyan(t(promptLang, "init.askCustomCopyFromNormal")),
          yesNoValidator
        );
        const yes = /^y(es)?$/i.test(ans);
        if (yes) {
          const normalConfig = readFileSync(normalConfigPath, "utf8");
          tpl = JSON.parse(normalConfig);
        } else {
          tpl = buildDefaultConfig(defaultsLang);
        }
      } catch (err) {
        if (isCancelledError(err)) {
          console.log(c.yellow(t(promptLang, "init.cancelled")));
          return;
        }
      } finally {
        rl?.close();
        try {
          input.pause?.();
        } catch {}
      }
    }
  }

  if (!tpl) {
    tpl = buildDefaultConfig(defaultsLang);
  }

  writeFileSync(configPath, JSON.stringify(tpl, null, 2) + "\n", "utf8");

  if (custom) {
    addToGitignore("commitzero.config.custom.json");
  }

  if (existed) {
    console.log(c.green(t(promptLang, overwrittenKey)));
  } else {
    console.log(t(promptLang, createdKey));
  }
}

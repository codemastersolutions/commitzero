import { existsSync, writeFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline";
import { DEFAULT_LANG, t } from "../../i18n/index.js";
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
            askQuestion(); // Repetir a pergunta
            return;
          }
        }

        resolve(trimmedAnswer);
      });
    };

    askQuestion();
  });
}

export async function initConfig(lang: import("../../i18n").Lang = DEFAULT_LANG) {
  const path = "commitzero.config.json";
  const existed = existsSync(path);
  if (existed) {
    const isTTY = !!input.isTTY;
    if (!isTTY) {
      console.log(t(lang, "init.exists"));
      return;
    }
    let rl: readline.Interface | null = null;
    try {
      rl = readline.createInterface({ input, output });

      // Validador para respostas y/N
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
        return t(lang, "commit.validation.yesNo") || "Please answer with 'y' or 'n'";
      };

      const ans = await askWithValidation(rl, c.cyan(t(lang, "init.askOverwrite")), yesNoValidator);
      const yes = /^y(es)?$/i.test(ans);
      if (!yes) {
        console.log(c.yellow(t(lang, "init.cancelled")));
        return;
      }
      console.log(c.yellow(t(lang, "init.willOverwrite")));
      const confirm = await askWithValidation(
        rl,
        c.cyan(t(lang, "init.confirmOverwrite")),
        yesNoValidator
      );
      const confirmed = /^y(es)?$/i.test(confirm);
      if (!confirmed) {
        console.log(c.yellow(t(lang, "init.cancelled")));
        return;
      }
    } catch {
      console.log(c.yellow(t(lang, "init.cancelled")));
      return;
    } finally {
      rl?.close();
      try {
        input.pause?.();
      } catch {}
    }
  }
  const tpl = {
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
    allowBreaking: true,
    footerKeywords: ["BREAKING CHANGE", "Closes", "Refs"],
    preCommitCommands: [],
    preCommitTimeout: "3m",
    versionCheckEnabled: true,
    versionCheckPeriod: "daily",
    language: existed ? DEFAULT_LANG : lang,
    uiAltScreen: true,
  };
  writeFileSync(path, JSON.stringify(tpl, null, 2) + "\n", "utf8");
  if (existed) {
    console.log(c.green(t(lang, "init.overwritten")));
  } else {
    console.log(t(lang, "init.created"));
  }
}

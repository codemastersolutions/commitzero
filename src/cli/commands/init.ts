import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline";
import { DEFAULT_LANG, t } from "../../i18n/index.js";
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

export async function initConfig(
  lang: import("../../i18n").Lang = DEFAULT_LANG,
  custom: boolean = false
) {
  const configPath = custom ? "commitzero.config.custom.json" : "commitzero.config.json";
  const normalConfigPath = "commitzero.config.json";
  const existed = existsSync(configPath);

  if (existed) {
    const isTTY = !!input.isTTY;
    if (!isTTY) {
      console.log(t(lang, "init.exists"));
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
          return t(lang, "commit.validation.yesNo") || "Please answer with 'y' or 'n'";
        };

        const ans = await askWithValidation(
          rl,
          c.cyan(
            "Deseja que o arquivo custom seja uma cópia do arquivo normal commitzero.config.json? (y/N) "
          ),
          yesNoValidator
        );
        const yes = /^y(es)?$/i.test(ans);
        if (yes) {
          const normalConfig = readFileSync(normalConfigPath, "utf8");
          tpl = JSON.parse(normalConfig);
        }
      } catch {
      } finally {
        rl?.close();
        try {
          input.pause?.();
        } catch {}
      }
    }
  }

  if (!tpl) {
    tpl = {
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
      language: existed ? DEFAULT_LANG : lang,
      uiAltScreen: true,
    };
  }

  writeFileSync(configPath, JSON.stringify(tpl, null, 2) + "\n", "utf8");

  if (custom) {
    addToGitignore("commitzero.config.custom.json");
  }

  if (existed) {
    console.log(c.green(t(lang, "init.overwritten")));
  } else {
    console.log(t(lang, "init.created"));
  }
}

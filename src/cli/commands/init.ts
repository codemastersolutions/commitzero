import { writeFileSync, existsSync } from "node:fs";
import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { t, DEFAULT_LANG } from "../../i18n/index.js";
import { c } from "../colors";

function ask(rl: readline.Interface, q: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const onSigint = () => {
      rl.removeListener("SIGINT", onSigint);
      reject(new Error("cancelled"));
    };
    rl.once("SIGINT", onSigint);
    rl.question(q, (answer: string) => {
      rl.removeListener("SIGINT", onSigint);
      resolve(answer.trim());
    });
  });
}

export async function initConfig(
  lang: import("../../i18n").Lang = DEFAULT_LANG
) {
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
      const ans = await ask(rl, c.cyan(t(lang, "init.askOverwrite")));
      const yes = /^y(es)?$/i.test(ans);
      if (!yes) {
        console.log(c.yellow(t(lang, "init.cancelled")));
        return;
      }
      console.log(c.yellow(t(lang, "init.willOverwrite")));
      const confirm = await ask(rl, c.cyan(t(lang, "init.confirmOverwrite")));
      const confirmed = /^y(es)?$/i.test(confirm);
      if (!confirmed) {
        console.log(c.yellow(t(lang, "init.cancelled")));
        return;
      }
      // proceed to overwrite with defaults below
  } catch {
      console.log(c.yellow(t(lang, "init.cancelled")));
      return;
  } finally {
      rl?.close();
      try { input.pause?.(); } catch {}
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
      "revert"
    ],
    scopes: [],
    requireScope: false,
    maxSubjectLength: 72,
    allowBreaking: true,
    footerKeywords: ["BREAKING CHANGE", "Closes", "Refs"],
    preCommitCommands: [],
    hookInstallPath: ".git/hooks",
    // When overwriting with defaults, set language to 'en' by default
    language: existed ? DEFAULT_LANG : lang
  };
  writeFileSync(path, JSON.stringify(tpl, null, 2) + "\n", "utf8");
  if (existed) {
    console.log(c.green(t(lang, "init.overwritten")));
  } else {
    console.log(t(lang, "init.created"));
  }
}
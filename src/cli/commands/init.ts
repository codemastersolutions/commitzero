import { writeFileSync, existsSync } from "node:fs";
import { t, DEFAULT_LANG } from "../../i18n/index.js";

export function initConfig(lang: import("../../i18n").Lang = DEFAULT_LANG) {
  const path = "commitzero.config.json";
  if (existsSync(path)) {
    console.log(t(lang, "init.exists"));
    return;
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
    hookInstallPath: ".git/hooks",
    language: lang
  };
  writeFileSync(path, JSON.stringify(tpl, null, 2) + "\n", "utf8");
  console.log(t(lang, "init.created"));
}
import { existsSync, readFileSync } from "node:fs";
import type { CommitType } from "../core/rules";
import type { Lang } from "../i18n";

export interface UserConfig {
  types?: CommitType[];
  scopes?: string[];
  requireScope?: boolean;
  maxSubjectLength?: number;
  allowBreaking?: boolean;
  footerKeywords?: string[];
  preCommitCommands?: string[];
  hookInstallPath?: string;
  language?: Lang;
}

export function loadConfig(cwd: string = process.cwd()): UserConfig {
  const jsonPath = `${cwd}/commitzero.config.json`;
  const jsPath = `${cwd}/commitzero.config.js`;
  if (existsSync(jsonPath)) {
    try {
      const raw = readFileSync(jsonPath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (existsSync(jsPath)) {
    try {
      const mod = require(jsPath);
      return mod?.default ?? mod ?? {};
    } catch {
      return {};
    }
  }
  return {};
}

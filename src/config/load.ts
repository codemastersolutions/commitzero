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
  maxFileSize?: number | string;
  preCommitCommands?: string[];
  preCommitTimeout?: string | number;
  enforceCommitZero?: boolean;
  versionCheckEnabled?: boolean;
  versionCheckPeriod?: string; // daily | weekly | monthly
  language?: Lang;
  uiAltScreen?: boolean;
  commitZero?: {
    uiAltScreen?: boolean;
    pushProgress?: boolean;
    preCommitTimeout?: string | number;
    enforceCommitZero?: boolean;
    versionCheckEnabled?: boolean;
    versionCheckPeriod?: string; // daily | weekly | monthly
  };
}

function loadConfigFile(path: string): UserConfig {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function loadConfig(cwd: string = process.cwd()): UserConfig {
  const customJsonPath = `${cwd}/commitzero.config.custom.json`;
  const customJsPath = `${cwd}/commitzero.config.custom.js`;
  const jsonPath = `${cwd}/commitzero.config.json`;
  const jsPath = `${cwd}/commitzero.config.js`;

  let config: UserConfig = {};

  if (existsSync(jsonPath)) {
    config = loadConfigFile(jsonPath);
  } else if (existsSync(jsPath)) {
    try {
      const mod = require(jsPath);
      config = mod?.default ?? mod ?? {};
    } catch {
      config = {};
    }
  }

  if (existsSync(customJsonPath)) {
    config = { ...config, ...loadConfigFile(customJsonPath) };
  } else if (existsSync(customJsPath)) {
    try {
      const mod = require(customJsPath);
      config = { ...config, ...(mod?.default ?? mod ?? {}) };
    } catch {}
  }

  return config;
}

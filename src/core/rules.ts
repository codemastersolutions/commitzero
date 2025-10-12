import { DEFAULT_LANG, t } from "../i18n/index.js";
export type CommitType =
  | "feat"
  | "fix"
  | "docs"
  | "style"
  | "refactor"
  | "perf"
  | "test"
  | "build"
  | "ci"
  | "chore"
  | "revert";

export interface LintOptions {
  types?: CommitType[];
  scopes?: string[];
  requireScope?: boolean;
  maxSubjectLength?: number;
  allowBreaking?: boolean;
  footerKeywords?: string[];
  language?: import("../i18n").Lang;
}

export interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const defaultOptions: Required<LintOptions> = {
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
  language: DEFAULT_LANG,
};

export interface ParsedCommit {
  type: string;
  scope?: string;
  subject: string;
  body?: string;
  footers?: { key: string; value: string }[];
  isBreaking?: boolean;
  meta?: {
    header: string;
    hasBlankAfterHeader: boolean;
    hasBlankBeforeFooter: boolean;
  };
}

export function lintCommit(commit: ParsedCommit, opts: LintOptions = {}): LintResult {
  const options: Required<LintOptions> = { ...defaultOptions, ...opts } as Required<LintOptions>;
  const errors: string[] = [];
  const warnings: string[] = [];
  const lang = options.language ?? DEFAULT_LANG;

  if (!options.types.includes(commit.type as CommitType)) {
    errors.push(t(lang, "rules.typeInvalid", { type: commit.type }));
  }

  if (commit.type !== commit.type.toLowerCase()) {
    errors.push(t(lang, "rules.typeLower"));
  }

  if (options.requireScope && !commit.scope) {
    errors.push(t(lang, "rules.scopeRequired"));
  }

  if (commit.scope && options.scopes.length > 0 && !options.scopes.includes(commit.scope)) {
    errors.push(t(lang, "rules.scopeInvalid", { scope: commit.scope }));
  }

  if (commit.scope) {
    const scopeValid = /^[a-z0-9\- ]+$/.test(commit.scope);
    if (!scopeValid) {
      errors.push(t(lang, "rules.scopePattern"));
    }
    if (commit.scope !== commit.scope.toLowerCase()) {
      errors.push(t(lang, "rules.scopeLower"));
    }
  }

  if (!commit.subject || commit.subject.trim().length === 0) {
    errors.push(t(lang, "rules.subjectEmpty"));
  }

  if (commit.subject.length > options.maxSubjectLength) {
    warnings.push(t(lang, "rules.subjectTooLong", { max: options.maxSubjectLength }));
  }

  if (commit.subject.trim().endsWith(".")) {
    errors.push(t(lang, "rules.subjectPeriod"));
  }

  if (commit.body && !(commit.meta && commit.meta.hasBlankAfterHeader)) {
    errors.push(t(lang, "rules.blankHeaderBody"));
  }

  if (
    commit.footers &&
    commit.footers.length > 0 &&
    !(commit.meta && commit.meta.hasBlankBeforeFooter)
  ) {
    errors.push(t(lang, "rules.blankBeforeFooters"));
  }

  const hasBreakingFooter = (commit.footers || []).some((f) => f.key === "BREAKING CHANGE");
  if (commit.isBreaking && !options.allowBreaking) {
    errors.push(t(lang, "rules.breakingNotAllowed"));
  }

  if (commit.isBreaking && !hasBreakingFooter) {
    errors.push(t(lang, "rules.breakingRequiresFooter"));
  }

  for (const f of commit.footers || []) {
    if (!options.footerKeywords.includes(f.key)) {
      warnings.push(t(lang, "rules.footerUnknown", { key: f.key }));
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

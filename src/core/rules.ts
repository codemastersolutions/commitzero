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
  maxFileSize?: number | string;
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
  maxFileSize: 2 * 1024 * 1024, // 2MB
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

function pushIf(condition: boolean, list: string[], msg: string): void {
  if (condition) list.push(msg);
}

function validateType(
  commit: ParsedCommit,
  options: Required<LintOptions>,
  lang: import("../i18n").Lang,
  errors: string[]
) {
  pushIf(
    !options.types.includes(commit.type as CommitType),
    errors,
    t(lang, "rules.typeInvalid", { type: commit.type })
  );
  pushIf(commit.type !== commit.type.toLowerCase(), errors, t(lang, "rules.typeLower"));
}

function validateScope(
  commit: ParsedCommit,
  options: Required<LintOptions>,
  lang: import("../i18n").Lang,
  errors: string[]
) {
  pushIf(!!options.requireScope && !commit.scope, errors, t(lang, "rules.scopeRequired"));
  if (!commit.scope) return;
  if (options.scopes.length > 0) {
    pushIf(
      !options.scopes.includes(commit.scope),
      errors,
      t(lang, "rules.scopeInvalid", { scope: commit.scope })
    );
  }
  const scopeValid = /^[\p{L}\p{N}\- .]+$/u.test(commit.scope);
  pushIf(!scopeValid, errors, t(lang, "rules.scopePattern"));
  pushIf(commit.scope !== commit.scope.toLowerCase(), errors, t(lang, "rules.scopeLower"));
}

function validateSubject(
  commit: ParsedCommit,
  options: Required<LintOptions>,
  lang: import("../i18n").Lang,
  errors: string[],
  warnings: string[]
) {
  const subject = commit.subject ?? "";
  pushIf(!subject || subject.trim().length === 0, errors, t(lang, "rules.subjectEmpty"));
  if (subject.length > options.maxSubjectLength) {
    warnings.push(t(lang, "rules.subjectTooLong", { max: options.maxSubjectLength }));
  }
  pushIf(subject.trim().endsWith("."), errors, t(lang, "rules.subjectPeriod"));
}

function validateBodyAndFooters(
  commit: ParsedCommit,
  lang: import("../i18n").Lang,
  errors: string[]
) {
  const hasBlankAfterHeader = !!commit.meta?.hasBlankAfterHeader;
  const hasBlankBeforeFooter = !!commit.meta?.hasBlankBeforeFooter;
  pushIf(!!commit.body && !hasBlankAfterHeader, errors, t(lang, "rules.blankHeaderBody"));
  pushIf(
    !!commit.footers?.length && !hasBlankBeforeFooter,
    errors,
    t(lang, "rules.blankBeforeFooters")
  );
}

function validateBreaking(
  commit: ParsedCommit,
  options: Required<LintOptions>,
  lang: import("../i18n").Lang,
  errors: string[]
) {
  const hasBreakingFooter = (commit.footers || []).some((f) => f.key === "BREAKING CHANGE");
  pushIf(
    !!commit.isBreaking && !options.allowBreaking,
    errors,
    t(lang, "rules.breakingNotAllowed")
  );
  pushIf(
    !!commit.isBreaking && !hasBreakingFooter,
    errors,
    t(lang, "rules.breakingRequiresFooter")
  );
}

function validateFooterKeywords(
  commit: ParsedCommit,
  options: Required<LintOptions>,
  lang: import("../i18n").Lang,
  warnings: string[]
) {
  for (const f of commit.footers || []) {
    if (!options.footerKeywords.includes(f.key)) {
      warnings.push(t(lang, "rules.footerUnknown", { key: f.key }));
    }
  }
}

export function lintCommit(commit: ParsedCommit, opts: LintOptions = {}): LintResult {
  const options: Required<LintOptions> = { ...defaultOptions, ...opts } as Required<LintOptions>;
  const errors: string[] = [];
  const warnings: string[] = [];
  const lang = options.language ?? DEFAULT_LANG;
  validateType(commit, options, lang, errors);
  validateScope(commit, options, lang, errors);
  validateSubject(commit, options, lang, errors, warnings);
  validateBodyAndFooters(commit, lang, errors);
  validateBreaking(commit, options, lang, errors);
  validateFooterKeywords(commit, options, lang, warnings);

  return { valid: errors.length === 0, errors, warnings };
}

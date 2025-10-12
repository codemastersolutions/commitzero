import type { ParsedCommit } from "./rules";

export function formatMessage(commit: ParsedCommit): string {
  const scope = commit.scope ? `(${commit.scope})` : "";
  const bang = commit.isBreaking && !commit.subject.includes("!") ? "!" : "";
  const header = `${commit.type}${scope}${bang}: ${commit.subject}`;
  const parts = [header];
  if (commit.body) parts.push("", commit.body);
  if (commit.footers && commit.footers.length) {
    parts.push("", ...commit.footers.map((f) => `${f.key}: ${f.value}`));
  }
  return parts.join("\n");
}

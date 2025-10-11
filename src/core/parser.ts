import type { ParsedCommit } from "./rules";

export function parseMessage(message: string): ParsedCommit {
  const lines = message.split(/\r?\n/);
  const header = lines[0] || "";
  const headerMatch = header.match(/^(?<type>[a-z]+)(\((?<scope>[^\)]+)\))?\:\s(?<subject>.+)$/);

  const type = headerMatch?.groups?.["type"] ?? "";
  const scope = headerMatch?.groups?.["scope"] ?? undefined;
  const subject = headerMatch?.groups?.["subject"] ?? "";

  let body: string | undefined;
  const footers: { key: string; value: string }[] = [];

  // Parse body and footers separated by blank line
  const rest = lines.slice(1);
  const hasBlankAfterHeader = rest.length > 0 ? rest[0].trim().length === 0 : false;
  const footerRegex = /^(?<key>[A-Za-z\- ]+):\s(?<value>.+)$/;
  let bodyLines: string[] = [];
  let footerStartIdx: number | null = null;

  for (const line of rest) {
    const m = line.match(footerRegex);
    if (m && m.groups) {
      if (footerStartIdx === null) footerStartIdx = bodyLines.length; // index within rest before footers
      footers.push({ key: m.groups["key"], value: m.groups["value"] });
    } else {
      bodyLines.push(line);
    }
  }

  body = bodyLines.join("\n").trim() || undefined;

  const isBreaking = subject.includes("!") || footers.some(f => f.key === "BREAKING CHANGE");

  const hasBlankBeforeFooter = (() => {
    if (footers.length === 0) return false;
    // Determine position of first footer in original rest
    const firstFooterIdx = rest.findIndex(l => footerRegex.test(l));
    if (firstFooterIdx <= 0) return false;
    return rest[firstFooterIdx - 1].trim().length === 0;
  })();

  return { type, scope, subject, body, footers, isBreaking, meta: { header, hasBlankAfterHeader, hasBlankBeforeFooter } };
}
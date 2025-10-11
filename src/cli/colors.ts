// Simple ANSI color utilities without external dependencies
// Honors NO_COLOR and FORCE_COLOR environment variables

const RESET = "\x1b[0m";

function enabled(): boolean {
  const noColor = !!process.env.NO_COLOR;
  const force = !!process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0";
  const isTTY = !!process.stdout.isTTY || !!process.stderr.isTTY;
  return force || (isTTY && !noColor);
}

function wrap(code: string, input: string): string {
  if (!enabled()) return input;
  return `\x1b[${code}m${input}${RESET}`;
}

export const c = {
  bold: (s: string) => wrap("1", s),
  dim: (s: string) => wrap("2", s),
  red: (s: string) => wrap("31", s),
  green: (s: string) => wrap("32", s),
  yellow: (s: string) => wrap("33", s),
  blue: (s: string) => wrap("34", s),
  magenta: (s: string) => wrap("35", s),
  cyan: (s: string) => wrap("36", s),
  gray: (s: string) => wrap("90", s)
};
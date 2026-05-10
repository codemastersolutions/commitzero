export function parseTimeToMs(input: string | number | undefined, defaultMs = 180000): number {
  if (input === undefined || input === null) return defaultMs;
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(0, Math.floor(input));
  const str = String(input).trim().toLowerCase();
  // Plain milliseconds
  if (/^\d+$/.test(str)) return Math.max(0, Number.parseInt(str, 10));
  // Seconds, e.g. 5s
  const secMatch = /^(\d+(?:\.\d+)?)s$/.exec(str);
  if (secMatch) return Math.max(0, Math.floor(Number.parseFloat(secMatch[1]) * 1000));
  // Minutes, e.g. 5m
  const minMatch = /^(\d+(?:\.\d+)?)m$/.exec(str);
  if (minMatch) return Math.max(0, Math.floor(Number.parseFloat(minMatch[1]) * 60000));
  // Fallback to default
  return defaultMs;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return `${ms}ms`;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.round(ms / 60000);
  return `${m}m`;
}

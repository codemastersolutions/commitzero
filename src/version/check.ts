import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import type { IncomingMessage } from "node:http";

export type Period = "daily" | "weekly" | "monthly";

export interface VersionCheckConfig {
  enabled: boolean;
  period: Period;
  cwd: string;
  packageName: string;
  currentVersion: string;
}

interface VersionCheckState {
  lastCheckedAt?: number;
  lastPromptedVersion?: string;
}

function getStatePath(cwd: string) {
  const dir = path.join(cwd, ".commitzero");
  const file = path.join(dir, "version-check.json");
  return { dir, file };
}

function ensureDir(p: string) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
}

function readState(cwd: string): VersionCheckState {
  const { file } = getStatePath(cwd);
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeState(cwd: string, st: VersionCheckState) {
  const { dir, file } = getStatePath(cwd);
  ensureDir(dir);
  try {
    fs.writeFileSync(file, JSON.stringify(st, null, 2));
  } catch {}
}

function msForPeriod(period: Period): number {
  switch (period) {
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
    case "daily":
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function shouldCheck(period: Period, lastCheckedAt?: number): boolean {
  if (!lastCheckedAt) return true;
  const now = Date.now();
  return now - lastCheckedAt >= msForPeriod(period);
}

function parseSemver(v: string): [number, number, number] | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function isNewer(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return a !== b; // fallback
  if (pa[0] !== pb[0]) return pa[0] > pb[0];
  if (pa[1] !== pb[1]) return pa[1] > pb[1];
  if (pa[2] !== pb[2]) return pa[2] > pb[2];
  return false;
}

export async function fetchLatestVersion(packageName: string): Promise<string | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  return new Promise((resolve) => {
    const req = https.get(url, (res: IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 400) {
        resolve(null);
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve(typeof json.version === "string" ? json.version : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(5000, () => {
      try { req.destroy(new Error("timeout")); } catch {}
      resolve(null);
    });
  });
}

export async function checkForUpdate(cfg: VersionCheckConfig): Promise<{ shouldPrompt: boolean; latestVersion?: string }> {
  if (!cfg.enabled) return { shouldPrompt: false };
  const state = readState(cfg.cwd);
  if (!shouldCheck(cfg.period, state.lastCheckedAt)) {
    return { shouldPrompt: false };
  }
  const latest = await fetchLatestVersion(cfg.packageName);
  const now = Date.now();
  writeState(cfg.cwd, { lastCheckedAt: now, lastPromptedVersion: latest || state.lastPromptedVersion });
  if (!latest) return { shouldPrompt: false };
  if (latest === cfg.currentVersion) return { shouldPrompt: false };
  if (!isNewer(latest, cfg.currentVersion)) return { shouldPrompt: false };
  return { shouldPrompt: true, latestVersion: latest };
}
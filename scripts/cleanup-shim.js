// ESM shim to safely run cleanup without failing when build output is absent
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = join(process.cwd(), "dist", "cjs", "hooks", "cleanup.js");
if (existsSync(target)) {
  try {
    const mod = await import(pathToFileURL(target).href);
    const fn = (mod && mod.cleanupHooks) || (mod && mod.default && mod.default.cleanupHooks);
    if (typeof fn === "function") {
      try {
        await fn();
      } catch {}
    }
  } catch {
    // swallow errors to avoid breaking uninstall
  }
}
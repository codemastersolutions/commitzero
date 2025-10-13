// ESM shim to safely run cleanup without failing when build output is absent
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = join(process.cwd(), "dist", "cjs", "hooks", "cleanup.js");
if (existsSync(target)) {
  try {
    await import(pathToFileURL(target).href);
  } catch {
    // swallow errors to avoid breaking uninstall
  }
}
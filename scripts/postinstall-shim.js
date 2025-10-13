// ESM shim to safely run postinstall without failing when build output is absent
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "dist", "cjs", "hooks", "postinstall.js");
if (existsSync(target)) {
  try {
    await import(pathToFileURL(target).href);
  } catch {
    // swallow errors to avoid breaking installs
  }
}
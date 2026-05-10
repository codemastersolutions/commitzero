import { mkdir, writeFile } from "node:fs/promises";

const pkgPath = new URL("../dist/cjs/package.json", import.meta.url);
await writeFile(pkgPath, JSON.stringify({ type: "commonjs" }, null, 2) + "\n", "utf8");

const cliDir = new URL("../dist/cjs/cli/", import.meta.url);
await mkdir(cliDir, { recursive: true });

const cliIndexPath = new URL("../dist/cjs/cli/index.js", import.meta.url);
await writeFile(
  cliIndexPath,
  `#!/usr/bin/env node
"use strict";

(async () => {
  try {
    await import("../../esm/cli/index.js");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
`,
  "utf8"
);

const cliTypesPath = new URL("../dist/cjs/cli/index.d.ts", import.meta.url);
await writeFile(cliTypesPath, "export {};\n", "utf8");

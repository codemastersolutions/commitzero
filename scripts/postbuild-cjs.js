// ESM script to write a local package.json to dist/cjs forcing CommonJS
import { writeFile } from "node:fs/promises";

const pkgPath = new URL("../dist/cjs/package.json", import.meta.url);
await writeFile(
  pkgPath,
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
  "utf8"
);

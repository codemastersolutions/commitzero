#!/usr/bin/env node
import fg from "fast-glob";
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import strip from "strip-comments";

async function main() {
  const patterns = ["src/**/*.{ts,js}", "test/**/*.{ts,js}", "scripts/**/*.{ts,js}"];
  const ignore = ["dist/**", "node_modules/**", "coverage/**", "tmp/**"];

  const files = await fg(patterns, { ignore, dot: true });

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const ext = extname(file);

    let shebang = "";
    let body = source;
    if (source.startsWith("#!/")) {
      const idx = source.indexOf("\n");
      shebang = idx !== -1 ? source.slice(0, idx + 1) : source;
      body = idx !== -1 ? source.slice(idx + 1) : "";
    }

    // Configurar modo de strip conforme extensão
    let stripped = body;
    if (ext === ".ts" || ext === ".js") {
      stripped = strip(body, { language: "javascript" });
    } else {
      stripped = body;
    }

    stripped = stripped.replace(/\n{3,}/g, "\n\n");

    const result = shebang + stripped;
    if (result !== source) {
      writeFileSync(file, result, "utf8");
      process.stdout.write(`Stripped comments: ${file}\n`);
    }
  }
}

main().catch((err) => {
  console.error("comments:strip failed", err);
  process.exitCode = 1;
});

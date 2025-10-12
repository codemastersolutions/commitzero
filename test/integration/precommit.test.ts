import assert from "node:assert";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const CLI = join(process.cwd(), "dist", "cjs", "cli", "index.js");

test("pre-commit without config prints none", () => {
  const tmp = join(process.cwd(), "tmp-precommit-none");
  mkdirSync(tmp, { recursive: true });
  try {
    const out = execSync(`node ${CLI} pre-commit`, { encoding: "utf8", cwd: tmp });
    assert.match(
      out,
      /No pre-commit commands configured\.|Nenhum comando de pre-commit configurado\.|No hay comandos de pre-commit configurados\./
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("pre-commit add, duplicate, remove, not found", () => {
  const tmp = join(process.cwd(), "tmp-precommit-manage");
  mkdirSync(tmp, { recursive: true });
  try {
    // initialize JSON config
    const initOut = execSync(`node ${CLI} init`, { encoding: "utf8", cwd: tmp });
    assert.match(initOut.toLowerCase(), /created|criado|creado/);
    const cfgPath = join(tmp, "commitzero.config.json");
    assert.ok(existsSync(cfgPath));

    // add command
    const addOut = execSync(`node ${CLI} pre-commit add "echo ok"`, { encoding: "utf8", cwd: tmp });
    assert.match(addOut, /Added pre-commit command|Comando de pre-commit adicionado|Comando de pre-commit agregado/);
    const cfg1 = JSON.parse(readFileSync(cfgPath, "utf8"));
    assert.ok(Array.isArray(cfg1.preCommitCommands));
    assert.strictEqual(cfg1.preCommitCommands.length, 1);
    assert.strictEqual(cfg1.preCommitCommands[0], "echo ok");

    // add duplicate
    const dupOut = execSync(`node ${CLI} pre-commit add "echo ok"`, { encoding: "utf8", cwd: tmp });
    assert.match(dupOut, /already present|já presente|ya presente/);
    const cfgDup = JSON.parse(readFileSync(cfgPath, "utf8"));
    assert.strictEqual(cfgDup.preCommitCommands.length, 1);

    // remove existing
    const remOut = execSync(`node ${CLI} pre-commit remove "echo ok"`, { encoding: "utf8", cwd: tmp });
    assert.match(remOut, /Removed pre-commit command|Comando de pre-commit removido|Comando de pre-commit quitado/);
    const cfg2 = JSON.parse(readFileSync(cfgPath, "utf8"));
    assert.ok(Array.isArray(cfg2.preCommitCommands));
    assert.strictEqual(cfg2.preCommitCommands.length, 0);

    // remove again -> not found, exit 1
    try {
      execSync(`node ${CLI} pre-commit remove "echo ok"`, { encoding: "utf8", cwd: tmp });
      assert.fail("expected CLI to exit with error when removing non-existent command");
    } catch (err: any) {
      const output = String((err.stdout || "") + (err.stderr || ""));
      assert.match(output, /Command not found|Comando não encontrado|Comando no encontrado/);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("pre-commit run success then failure stops sequence", () => {
  const tmp = join(process.cwd(), "tmp-precommit-run");
  mkdirSync(tmp, { recursive: true });
  try {
    const cfgPath = join(tmp, "commitzero.config.json");
    const cfg = {
      preCommitCommands: [
        "node -e \"console.log('ok')\"",
        "node -e \"process.exit(1)\"",
      ],
    };
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
    try {
      execSync(`node ${CLI} pre-commit`, { encoding: "utf8", cwd: tmp });
      assert.fail("expected CLI to exit with error on failing pre-commit");
    } catch (err: any) {
      const output = String((err.stdout || "") + (err.stderr || ""));
      assert.match(output, /Running pre-commit:|Executando pre-commit:|Ejecutando pre-commit:/);
      assert.match(output, /Pre-commit failed on:|Pre-commit falhou em:|Pre-commit falló en:/);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("pre-commit run all success prints ok", () => {
  const tmp = join(process.cwd(), "tmp-precommit-run-ok");
  mkdirSync(tmp, { recursive: true });
  try {
    const cfgPath = join(tmp, "commitzero.config.json");
    const cfg = {
      preCommitCommands: [
        "node -e \"1+1\"",
        "node -e \"console.log('ok')\"",
      ],
    };
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
    const out = execSync(`node ${CLI} pre-commit`, { encoding: "utf8", cwd: tmp });
    assert.match(out, /Pre-commit commands completed successfully\.|Comandos de pre-commit concluídos com sucesso\.|Comandos de pre-commit completados con éxito\./);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline";
import { formatMessage } from "../../core/formatter";
import {
  defaultOptions,
  lintCommit,
  type ParsedCommit,
} from "../../core/rules";
import { t, type Lang } from "../../i18n/index.js";
import { c } from "../colors";
import { select } from "./select";

function ask(rl: readline.Interface, q: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const onSigint = () => {
      rl.removeListener("SIGINT", onSigint);
      reject(new Error("cancelled"));
    };
    rl.once("SIGINT", onSigint);
    rl.question(q, (answer: string) => {
      rl.removeListener("SIGINT", onSigint);
      resolve(answer.trim());
    });
  });
}

export async function interactiveCommit(
  lang: Lang,
  cfg?: Partial<typeof defaultOptions> & {
    autoAdd?: boolean;
    autoPush?: boolean;
  }
): Promise<number> {
  let rl: readline.Interface | null = null;
  try {
    // Pré-checagem do git: verificar se há arquivos staged
    function hasStaged(): boolean {
      try {
        const out = execSync("git diff --cached --name-only", {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        return out.length > 0;
      } catch {
        return false;
      }
    }
    function hasChanges(): boolean {
      try {
        const out = execSync("git status --porcelain", {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        return out.length > 0;
      } catch {
        return false;
      }
    }
    if (!hasStaged()) {
      const autoAdd = cfg?.autoAdd === true;
      if (autoAdd) {
        if (hasChanges()) {
          try {
            const out = execSync("git add -A", {
              stdio: ["ignore", "pipe", "pipe"],
              encoding: "utf8",
            });
            if (out) process.stdout.write(out);
          } catch (err: any) {
            const errOut = err && err.stderr ? String(err.stderr) : "";
            if (errOut) process.stderr.write(errOut);
            console.error(c.red(String(err)));
            return 1;
          }
          if (!hasStaged()) {
            console.error(c.red(t(lang, "commit.git.abort")));
            return 1;
          }
        } else {
          // Nenhuma modificação a adicionar; siga para próxima etapa sem erro
        }
      } else {
        if (hasChanges()) {
          // In CI/coverage/test environments, skip interactive add prompt
          const skipAddPrompt =
            process.env.COMMITSKIP_ADD_PROMPT === "1" ||
            process.env.CI === "true" ||
            process.env.NODE_TEST === "1";
          if (skipAddPrompt) {
            console.error(c.red(t(lang, "commit.git.abort")));
            return 1;
          }
          // Only prompt when both stdin and stdout are TTY
          const isInteractive = !!input.isTTY && !!output.isTTY;
          if (!isInteractive) {
            console.error(c.red(t(lang, "commit.git.abort")));
            return 1;
          }
          rl = readline.createInterface({ input, output });
          let addAns: string;
          try {
            addAns = await ask(rl, c.cyan(t(lang, "commit.git.askAdd")));
          } catch {
            // Cancelado via Ctrl+C na pergunta do git add
            console.log(c.yellow(t(lang, "commit.cancelled")));
            return 130;
          } finally {
            rl.close();
            try { input.pause?.(); } catch {}
            rl = null;
          }
          const wantsAdd = /^y(es)?$/i.test(addAns);
          if (wantsAdd) {
            try {
              const out = execSync("git add -A", {
                stdio: ["ignore", "pipe", "pipe"],
                encoding: "utf8",
              });
              if (out) process.stdout.write(out);
            } catch (err: any) {
              const errOut = err && err.stderr ? String(err.stderr) : "";
              if (errOut) process.stderr.write(errOut);
              console.error(c.red(String(err)));
              return 1;
            }
            if (!hasStaged()) {
              console.error(c.red(t(lang, "commit.git.abort")));
              return 1;
            }
          } else {
            console.error(c.red(t(lang, "commit.git.abort")));
            return 1;
          }
        } else {
          console.error(c.red(t(lang, "commit.git.abort")));
          return 1;
        }
      }
    }
    const types =
      cfg?.types && cfg.types.length ? cfg.types : defaultOptions.types;
    const typeItems = types.map((ty) => ({
      value: ty,
      label: `${ty}:`,
      description: t(lang, `type.desc.${ty}`),
    }));
    // Identificação da biblioteca com versão instalada
    let version = "";
    try {
      const pkgPath1 = join(__dirname, "../../../../package.json");
      const raw1 = readFileSync(pkgPath1, "utf8");
      const pkg1 = JSON.parse(raw1);
      version = pkg1?.version ? ` v${pkg1.version}` : "";
    } catch {
      try {
        const pkgPath2 = require.resolve(
          "@codemastersolutions/commitzero/package.json"
        );
        const raw2 = readFileSync(pkgPath2, "utf8");
        const pkg2 = JSON.parse(raw2);
        version = pkg2?.version ? ` v${pkg2.version}` : "";
      } catch {
        const envVersion = process.env.npm_package_version;
        if (envVersion) version = ` v${envVersion}`;
      }
    }
    const headerText = `CommitZero CLI${version}`;
    let type: string;
    try {
      type = await select(
        c.bold(t(lang, "commit.select.type")),
        typeItems,
        headerText
      );
    } catch {
      // Cancelado via Ctrl+C no seletor: informar e encerrar
      console.log(c.yellow(t(lang, "commit.cancelled")));
      return 130;
    }
    // Mostrar tipo escolhido antes do Scope
    console.log(c.green(c.bold(t(lang, "commit.chosen.type", { type }))));
    rl = readline.createInterface({ input, output });
    let scope: string;
    let subject: string;
    let body: string;
    let breakingAns: string;
    let breakingDetails: string = "";
    try {
      scope = await ask(rl, c.cyan(t(lang, "commit.prompt.scope")));
      subject = await ask(rl, c.cyan(t(lang, "commit.prompt.subject")));
      body = await ask(rl, c.cyan(t(lang, "commit.prompt.body")));
      breakingAns = await ask(rl, c.cyan(t(lang, "commit.prompt.breaking")));
      const isBreakingTmp = /^y(es)?$/i.test(breakingAns);
      if (isBreakingTmp) {
        breakingDetails = await ask(
          rl,
          c.cyan(t(lang, "commit.prompt.breakingDetails"))
        );
      }
    } catch {
      // Cancelado via Ctrl+C durante os prompts: informar e encerrar
      console.log(c.yellow(t(lang, "commit.cancelled")));
      return 130;
    }
    const isBreaking = /^y(es)?$/i.test(breakingAns);
    const footers = isBreaking
      ? [{ key: "BREAKING CHANGE", value: breakingDetails }]
      : [];

    const commit: ParsedCommit = {
      type,
      scope: scope || undefined,
      subject,
      body: body || undefined,
      isBreaking,
      footers,
      meta: {
        header: `${type}${scope ? `(${scope})` : ""}${
          isBreaking && !subject.includes("!") ? "!" : ""
        }: ${subject}`,
        hasBlankAfterHeader: body ? true : false,
        hasBlankBeforeFooter: footers.length > 0,
      },
    };

    const result = lintCommit(commit, {
      ...defaultOptions,
      ...cfg,
      language: lang,
    });
    if (!result.valid) {
      console.error(
        c.red(t(lang, "cli.invalid")) +
          "\n" +
          result.errors.map((e) => c.red(`- ${e}`)).join("\n")
      );
      return 1;
    }

    if (result.warnings.length) {
      console.warn(
        result.warnings
          .map((w) => c.yellow(t(lang, "cli.warning", { msg: w })))
          .join("\n")
      );
    }

    const msg = formatMessage(commit);
    writeFileSync(".git/COMMIT_EDITMSG", msg, "utf8");
    const createdHdr = t(lang, "commit.created", { msg: "" }).trimEnd();
    console.log(c.green(createdHdr));
    console.log("\n" + msg);
    // Execute the actual git commit using the generated message
    try {
      const commitOut = execSync("git commit -F .git/COMMIT_EDITMSG", {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
      if (commitOut) process.stdout.write(commitOut);
      // Auto push if requested
      if (cfg?.autoPush) {
        try {
          const pushOut = execSync("git push", {
            stdio: ["ignore", "pipe", "pipe"],
            encoding: "utf8",
          });
          if (pushOut) process.stdout.write(pushOut);
        } catch (err: any) {
          const errOut = err && err.stderr ? String(err.stderr) : "";
          if (errOut) process.stderr.write(errOut);
          console.error(c.red(String(err)));
          return 1;
        }
      }
      return 0;
    } catch (err: any) {
      const errOut = err && err.stderr ? String(err.stderr) : "";
      if (errOut) process.stderr.write(errOut);
      console.error(c.red(String(err)));
      return 1;
    }
  } finally {
    rl?.close();
    try { input.pause?.(); } catch {}
  }
}

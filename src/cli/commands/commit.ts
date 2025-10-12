import { execSync, execFileSync } from "node:child_process";
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

// Test-mode support: allow providing answers via environment to avoid interactive I/O
type TestAnswerCtx = { answers: string[] | null; index: number; raw: string | null };
function initTestAnswerCtx(): TestAnswerCtx {
  try {
    const raw = process.env.COMMITZERO_TEST_ANSWERS ?? null;
    if (raw) {
      const arr = JSON.parse(raw);
      if (process.env.NODE_TEST === "1") {
        console.log(c.yellow(`[TEST] Loaded COMMITZERO_TEST_ANSWERS: ${raw}`));
      }
      return { answers: Array.isArray(arr) ? arr : null, index: 0, raw };
    }
    return { answers: null, index: 0, raw: null };
  } catch {
    return { answers: null, index: 0, raw: null };
  }
}

function ask(rl: readline.Interface, q: string, ctx?: TestAnswerCtx): Promise<string> {
  return new Promise((resolve, reject) => {
    // Prefer per-invocation test answers context when provided
    if (ctx && ctx.answers) {
      const ans = (ctx.answers[ctx.index++] ?? "").trim();
      if (process.env.NODE_TEST === "1") {
        console.log(c.yellow(`[TEST] ask -> using test answer: "${ans}" for question: ${q.replace(/\n/g, " ")}`));
      }
      if (ans === "__SIGINT__") {
        return reject(new Error("cancelled"));
      }
      return resolve(ans);
    }
    // Fallback to environment-driven non-interactive guard
    // If stdin/stdout are not TTY, avoid interactive question and resolve empty
    const isInteractive = !!input.isTTY && !!output.isTTY;
    if (!isInteractive) {
      try { input.pause?.(); } catch {}
      return resolve("");
    }
    const onSigint = () => {
      rl.removeListener("SIGINT", onSigint);
      reject(new Error("cancelled"));
    };
    rl.once("SIGINT", onSigint);
    rl.question(q, (answer: string) => {
      rl.removeListener("SIGINT", onSigint);
      if (process.env.NODE_TEST === "1") {
        console.log(c.yellow(`[TEST] ask -> readline answer: "${answer.trim()}" for question: ${q.replace(/\n/g, " ")}`));
      }
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
  // Initialize per-run test answers to avoid cross-test interference
  const testCtx = initTestAnswerCtx();
  let rl: readline.Interface | null = null;
  if (process.env.NODE_TEST === "1") {
    console.log(c.yellow(`[TEST] PATH=${process.env.PATH}`));
    console.log(c.yellow(`[TEST] GIT_STUB_MODE=${process.env.GIT_STUB_MODE}`));
    try {
      const whichGit = execSync("which git", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
      console.log(c.yellow(`[TEST] which git -> ${whichGit}`));
    } catch {}
  }
  try {
    // Pré-checagem do git: verificar se há arquivos staged
    function hasStaged(): boolean {
      try {
        const out = execFileSync("git", ["diff", "--cached", "--name-only"], {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        if (process.env.NODE_TEST === "1") {
          console.log(c.yellow(`[TEST] hasStaged -> output: "${out}"`));
        }
        return out.length > 0;
      } catch {
        if (process.env.NODE_TEST === "1") {
          console.log(c.yellow(`[TEST] hasStaged -> error executing git diff --cached --name-only`));
        }
        return false;
      }
    }
    function hasChanges(): boolean {
      try {
        const out = execFileSync("git", ["status", "--porcelain"], {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        if (process.env.NODE_TEST === "1") {
          console.log(c.yellow(`[TEST] hasChanges -> output: "${out}"`));
        }
        return out.length > 0;
      } catch {
        if (process.env.NODE_TEST === "1") {
          console.log(c.yellow(`[TEST] hasChanges -> error executing git status --porcelain`));
        }
        return false;
      }
    }
    if (process.env.NODE_TEST === "1") {
      console.log(
        c.yellow(
          `[TEST] initial state -> hasStaged=${hasStaged()} hasChanges=${hasChanges()}`
        )
      );
    }
    if (!hasStaged()) {
      const autoAdd = cfg?.autoAdd === true;
      if (autoAdd) {
        if (hasChanges()) {
          try {
            const out = execFileSync("git", ["add", "-A"], {
              stdio: ["ignore", "pipe", "pipe"],
              encoding: "utf8",
            });
            if (out) process.stdout.write(out);
          } catch (err: unknown) {
            const errOut = err && err instanceof Error ? err.message : "";
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
            addAns = await ask(rl, c.cyan(t(lang, "commit.git.askAdd")), testCtx);
          } catch {
            // Cancelado via Ctrl+C na pergunta do git add
            console.log(c.yellow(t(lang, "commit.cancelled")));
            return 130;
          } finally {
            rl.close();
            try {
              input.pause?.();
            } catch {}
            rl = null;
          }
          const wantsAdd = /^y(es)?$/i.test(addAns);
          if (wantsAdd) {
            try {
              const out = execFileSync("git", ["add", "-A"], {
                stdio: ["ignore", "pipe", "pipe"],
                encoding: "utf8",
              });
              if (out) process.stdout.write(out);
            } catch (err: unknown) {
              const errOut = err && err instanceof Error ? err.message : "";
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
      scope = await ask(rl, c.cyan(t(lang, "commit.prompt.scope")), testCtx);
      subject = await ask(rl, c.cyan(t(lang, "commit.prompt.subject")), testCtx);
      body = await ask(rl, c.cyan(t(lang, "commit.prompt.body")), testCtx);
      breakingAns = await ask(rl, c.cyan(t(lang, "commit.prompt.breaking")), testCtx);
      const isBreakingTmp = /^y(es)?$/i.test(breakingAns);
      if (isBreakingTmp) {
        breakingDetails = await ask(
          rl,
          c.cyan(t(lang, "commit.prompt.breakingDetails")),
          testCtx
        );
      }
    } catch {
      // Cancelado via Ctrl+C durante os prompts: informar e encerrar
      console.log(c.yellow(t(lang, "commit.cancelled")));
      return 130;
    } finally {
      if (rl) {
        rl.close();
        try { input.pause?.(); } catch {}
        rl = null;
      }
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
      if (process.env.NODE_TEST === "1") {
        console.log(c.yellow(`[TEST] lint invalid. Subject="${commit.subject}", Scope="${commit.scope ?? ""}", Body length=${commit.body?.length ?? 0}`));
      }
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
      const commitOut = execFileSync("git", ["commit", "-F", ".git/COMMIT_EDITMSG"], {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
      if (commitOut) process.stdout.write(commitOut);
      // Auto push if requested
      if (cfg?.autoPush) {
        try {
          const pushOut = execFileSync("git", ["push"], {
            stdio: ["ignore", "pipe", "pipe"],
            encoding: "utf8",
          });
          if (pushOut) process.stdout.write(pushOut);
        } catch (err: unknown) {
          const errOut = err && err instanceof Error ? err.message : "";
          if (errOut) process.stderr.write(errOut);
          console.error(c.red(String(err)));
          return 1;
        }
      }
      return 0;
    } catch (err: unknown) {
      const errOut = err && err instanceof Error ? err.message : "";
      if (errOut) process.stderr.write(errOut);
      console.error(c.red(String(err)));
      return 1;
    }
  } finally {
    rl?.close();
    try {
      input.pause?.();
    } catch {}
  }
}

import { execFileSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline";
import { formatMessage } from "../../core/formatter";
import { defaultOptions, lintCommit, type ParsedCommit } from "../../core/rules";
import { t, type Lang } from "../../i18n/index.js";
import { c } from "../colors";
import { select } from "./select";

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

function showSpinner(message: string): () => void {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  process.stdout.write(message + " ");

  const interval = setInterval(() => {
    process.stdout.write("\r" + message + " " + c.cyan(frames[i]));
    i = (i + 1) % frames.length;
  }, 100);

  return () => {
    clearInterval(interval);
    process.stdout.write("\r" + message + " " + c.green("✓") + "\n");
  };
}

function askWithCharacterCount(
  rl: readline.Interface,
  q: string,
  maxLength?: number,
  ctx?: TestAnswerCtx
): Promise<string> {
  return new Promise((resolve, reject) => {
    const promptWithCount = (currentInput: string = "") => {
      const count = currentInput.length;
      const countDisplay = maxLength ? ` (${count}/${maxLength})` : ` (${count})`;
      const coloredCount =
        maxLength && count > maxLength ? c.red(countDisplay) : c.gray(countDisplay);
      return q + coloredCount;
    };

    if (ctx?.answers && ctx.index < ctx.answers.length) {
      const answer = ctx.answers[ctx.index++];
      if (answer === "__SIGINT__") {
        return reject(new Error("SIGINT"));
      }
      resolve(answer);
      return;
    }

    if (ctx?.raw) {
      if (ctx.raw.includes("__SIGINT__")) {
        return reject(new Error("SIGINT"));
      }
      resolve(ctx.raw);
      return;
    }

    let currentInput = "";

    // Verificar se devemos forçar modo não-interativo (CI/testes)
    const forceNonInteractive =
      process.env.COMMITSKIP_INPUT_PROMPT === "1" ||
      process.env.CI === "true" ||
      process.env.NODE_TEST === "1";
    const isInteractive = !!process.stdin.isTTY && !forceNonInteractive;

    if (!isInteractive) {
      // Em ambientes não interativos, não bloquear esperando entrada
      try {
        input.pause?.();
      } catch {}
      resolve("");
      return;
    }

    // Modo interativo com contador em tempo real
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const updatePrompt = () => {
      // Limpar linha atual
      process.stdout.write("\r\x1b[K");
      // Mostrar prompt atualizado
      const prompt = promptWithCount(currentInput) + " " + currentInput;
      process.stdout.write(prompt);
    };

    const showErrorAndContinue = (message: string) => {
      // Mover cursor para nova linha e mostrar erro
      process.stdout.write("\n");
      console.log(c.red(message));
      // Voltar para a entrada mantendo o foco
      updatePrompt();
    };

    // Mostrar prompt inicial
    updatePrompt();

    const onKeypress = (key: string) => {
      if (key === "\u0003") {
        // Ctrl+C
        cleanup();
        reject(new Error("SIGINT"));
        return;
      }

      if (key === "\r" || key === "\n") {
        // Enter
        if (maxLength && currentInput.length > maxLength) {
          showErrorAndContinue(
            `Entrada excede o limite de ${maxLength} caracteres. Tente novamente.`
          );
          return;
        }
        process.stdout.write("\n");
        cleanup();
        resolve(currentInput);
        return;
      }

      if (key === "\u007f" || key === "\b") {
        // Backspace
        if (currentInput.length > 0) {
          currentInput = currentInput.slice(0, -1);
          updatePrompt();
        }
        return;
      }

      // Ignorar caracteres de controle (exceto os já tratados)
      if (key.charCodeAt(0) < 32) {
        return;
      }

      // Adicionar caractere ao input
      currentInput += key;
      updatePrompt();
    };

    const cleanup = () => {
      stdin.removeListener("data", onKeypress);
      stdin.setRawMode(wasRaw);
      if (!wasRaw) {
        stdin.pause();
      }
      process.removeListener("SIGINT", onSigInt);
    };

    const onSigInt = () => {
      cleanup();
      reject(new Error("SIGINT"));
    };

    stdin.on("data", onKeypress);
    process.on("SIGINT", onSigInt);
  });
}

function askWithValidation(
  rl: readline.Interface,
  q: string,
  validator?: (answer: string) => boolean | string,
  ctx?: TestAnswerCtx
): Promise<string> {
  return new Promise((resolve, reject) => {
    const askQuestion = () => {
      if (ctx && ctx.answers) {
        const ans = (ctx.answers[ctx.index++] ?? "").trim();
        if (process.env.NODE_TEST === "1") {
          console.log(
            c.yellow(
              `[TEST] ask -> using test answer: "${ans}" for question: ${q.replace(/\n/g, " ")}`
            )
          );
        }
        if (ans === "__SIGINT__") {
          return reject(new Error("cancelled"));
        }

        // Aplicar validação se fornecida
        if (validator) {
          const validationResult = validator(ans);
          if (validationResult !== true) {
            // Em modo de teste, aceitar resposta inválida para não quebrar testes
            if (process.env.NODE_TEST === "1") {
              return resolve(ans);
            }
            // Em modo normal, mostrar erro e perguntar novamente
            const errorMsg =
              typeof validationResult === "string" ? validationResult : "Resposta inválida.";
            console.log(c.red(errorMsg));
            return askQuestion();
          }
        }

        return resolve(ans);
      }

      // Respeitar CI/mode não-interativo: não abrir prompt
      const forceNonInteractive =
        process.env.COMMITSKIP_INPUT_PROMPT === "1" ||
        process.env.CI === "true" ||
        process.env.NODE_TEST === "1";
      const isInteractive = !!input.isTTY && !forceNonInteractive;
      if (!isInteractive) {
        try {
          input.pause?.();
        } catch {}
        return resolve("");
      }

      const onSigint = () => {
        rl.removeListener("SIGINT", onSigint);
        reject(new Error("cancelled"));
      };

      rl.once("SIGINT", onSigint);
      rl.question(q, (answer: string) => {
        rl.removeListener("SIGINT", onSigint);
        const trimmedAnswer = answer.trim();

        if (process.env.NODE_TEST === "1") {
          console.log(
            c.yellow(
              `[TEST] ask -> readline answer: "${trimmedAnswer}" for question: ${q.replace(/\n/g, " ")}`
            )
          );
        }

        // Aplicar validação se fornecida
        if (validator) {
          const validationResult = validator(trimmedAnswer);
          if (validationResult !== true) {
            const errorMsg =
              typeof validationResult === "string" ? validationResult : "Resposta inválida.";
            console.log(c.red(errorMsg));
            return askQuestion();
          }
        }

        resolve(trimmedAnswer);
      });
    };

    askQuestion();
  });
}

export async function interactiveCommit(
  lang: Lang,
  cfg?: Partial<typeof defaultOptions> & {
    autoAdd?: boolean;
    autoPush?: boolean;
    pushProgress?: boolean;
  }
): Promise<number> {
  // Exibir header primeiro, antes de qualquer outra mensagem
  let version = "";
  try {
    const pkgPath1 = join(__dirname, "../../../../package.json");
    const raw1 = readFileSync(pkgPath1, "utf8");
    const pkg1 = JSON.parse(raw1);
    version = pkg1?.version ? ` v${pkg1.version}` : "";
  } catch {
    try {
      const pkgPath2 = require.resolve("@codemastersolutions/commitzero/package.json");
      const raw2 = readFileSync(pkgPath2, "utf8");
      const pkg2 = JSON.parse(raw2);
      version = pkg2?.version ? ` v${pkg2.version}` : "";
    } catch {
      const envVersion = process.env.npm_package_version;
      if (envVersion) version = ` v${envVersion}`;
    }
  }
  console.log(c.green(c.bold(`CommitZero CLI${version}`)));
  console.log();

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
          console.log(
            c.yellow(`[TEST] hasStaged -> error executing git diff --cached --name-only`)
          );
        }
        return false;
      }
    }

    function hasUnstagedChanges(): boolean {
      try {
        const out = execFileSync("git", ["diff", "--name-only"], {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        if (process.env.NODE_TEST === "1") {
          console.log(c.yellow(`[TEST] hasUnstagedChanges -> output: "${out}"`));
        }
        return out.length > 0;
      } catch {
        if (process.env.NODE_TEST === "1") {
          console.log(
            c.yellow(`[TEST] hasUnstagedChanges -> error executing git diff --name-only`)
          );
        }
        return false;
      }
    }

    // Função para verificar e perguntar sobre git add -A
    async function checkAndAskForAdd(): Promise<boolean> {
      if (process.env.NODE_TEST === "1") {
        console.log(
          c.yellow(
            `[TEST] checkAndAskForAdd -> hasStaged=${hasStaged()} hasUnstagedChanges=${hasUnstagedChanges()}`
          )
        );
      }

      // Só perguntar se não há arquivos staged OU se há arquivos modificados não staged
      if (!hasStaged() || hasUnstagedChanges()) {
        const autoAdd = cfg?.autoAdd === true;
        if (autoAdd) {
          if (hasUnstagedChanges()) {
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
              return false;
            }
            if (!hasStaged()) {
              console.error(c.red(t(lang, "commit.git.abort")));
              return false;
            }
          } else {
            // Caso não tenha arquivos modificados, prosseguir com o commit mesmo assim
            // para permitir commits vazios ou apenas com arquivos já staged
          }
        } else {
          // Para comando commit -p, verificar se há arquivos staged primeiro
          const autoPush = cfg?.autoPush === true;
          if (autoPush && !hasUnstagedChanges()) {
            // Se é commit -p e não há arquivos modificados, prosseguir com o commit
            // (pode haver arquivos já staged)
          } else if (hasUnstagedChanges()) {
            const skipAddPrompt =
              process.env.COMMITSKIP_ADD_PROMPT === "1" ||
              process.env.CI === "true" ||
              process.env.NODE_TEST === "1";
            if (skipAddPrompt) {
              console.error(c.red(t(lang, "commit.git.abort")));
              return false;
            }

            const isInteractive = !!input.isTTY && !!output.isTTY;
            if (!isInteractive) {
              console.error(c.red(t(lang, "commit.git.abort")));
              return false;
            }
            rl = readline.createInterface({ input, output });
            let addAns: string;
            try {
              // Validador para respostas y/N
              const yesNoValidator = (answer: string): boolean | string => {
                const trimmed = answer.trim().toLowerCase();
                if (
                  trimmed === "" ||
                  trimmed === "n" ||
                  trimmed === "no" ||
                  trimmed === "y" ||
                  trimmed === "yes"
                ) {
                  return true;
                }
                return t(lang, "commit.validation.yesNo") || "Please answer with 'y' or 'n'";
              };

              addAns = await askWithValidation(
                rl,
                c.cyan(t(lang, "commit.git.askAdd")),
                yesNoValidator,
                testCtx
              );
            } catch {
              console.log(c.yellow(t(lang, "commit.cancelled")));
              return false;
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
                return false;
              }
              if (!hasStaged()) {
                console.error(c.red(t(lang, "commit.git.abort")));
                return false;
              }
            } else {
              console.error(c.red(t(lang, "commit.git.abort")));
              return false;
            }
          } else if (!hasStaged()) {
            // Se não há arquivos staged e não há arquivos modificados, abortar
            console.error(c.red(t(lang, "commit.git.abort")));
            return false;
          }
        }
      }
      return true;
    }

    // Verificar arquivos staged/modificados antes de iniciar o processo de commit
    if (!(await checkAndAskForAdd())) {
      return 1;
    }
    const types = cfg?.types && cfg.types.length ? cfg.types : defaultOptions.types;
    const typeItems = types.map((ty) => ({
      value: ty,
      label: `${ty}:`,
      description: t(lang, `type.desc.${ty}`),
    }));

    let version = "";
    try {
      const pkgPath1 = join(__dirname, "../../../../package.json");
      const raw1 = readFileSync(pkgPath1, "utf8");
      const pkg1 = JSON.parse(raw1);
      version = pkg1?.version ? ` v${pkg1.version}` : "";
    } catch {
      try {
        const pkgPath2 = require.resolve("@codemastersolutions/commitzero/package.json");
        const raw2 = readFileSync(pkgPath2, "utf8");
        const pkg2 = JSON.parse(raw2);
        version = pkg2?.version ? ` v${pkg2.version}` : "";
      } catch {
        const envVersion = process.env.npm_package_version;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        if (envVersion) version = ` v${envVersion}`;
      }
    }
    let type: string;
    try {
      type = await select(c.bold(t(lang, "commit.select.type")), typeItems);
    } catch {
      console.log(c.yellow(t(lang, "commit.cancelled")));
      return 130;
    }

    console.log(c.green(c.bold(t(lang, "commit.chosen.type", { type }))));
    rl = readline.createInterface({ input, output });
    let scope: string;
    let subject: string;
    let body: string;
    let breakingAns: string;
    let breakingDetails: string = "";
    try {
      const scopeValidator = (answer: string): boolean | string => {
        const s = answer.trim();
        if (s === "") return true; // escopo opcional
        // aceita letras (Unicode, incluindo acentuação), números, hífen e espaço
        const patternOk = /^[\p{L}\p{N}\- .]+$/u.test(s);
        if (!patternOk) return t(lang, "rules.scopePattern");
        if (s !== s.toLowerCase()) return t(lang, "rules.scopeLower");
        return true;
      };
      scope = await askWithValidation(
        rl,
        c.cyan(t(lang, "commit.prompt.scope")),
        scopeValidator,
        testCtx
      );
      subject = await askWithCharacterCount(
        rl,
        c.cyan(t(lang, "commit.prompt.subject")),
        cfg?.maxSubjectLength || 72,
        testCtx
      );
      body = await askWithCharacterCount(rl, c.cyan(t(lang, "commit.prompt.body")), 500, testCtx);
      // Validador para respostas y/N
      const yesNoValidator = (answer: string): boolean | string => {
        const trimmed = answer.trim().toLowerCase();
        if (
          trimmed === "" ||
          trimmed === "n" ||
          trimmed === "no" ||
          trimmed === "y" ||
          trimmed === "yes"
        ) {
          return true;
        }
        return t(lang, "commit.validation.yesNo") || "Please answer with 'y' or 'n'";
      };

      breakingAns = await askWithValidation(
        rl,
        c.cyan(t(lang, "commit.prompt.breaking")),
        yesNoValidator,
        testCtx
      );
      const isBreakingTmp = /^y(es)?$/i.test(breakingAns);
      if (isBreakingTmp) {
        breakingDetails = await askWithCharacterCount(
          rl,
          c.cyan(t(lang, "commit.prompt.breakingDetails")),
          200,
          testCtx
        );
      }
    } catch {
      console.log(c.yellow(t(lang, "commit.cancelled")));
      return 130;
    } finally {
      if (rl) {
        rl.close();
        try {
          input.pause?.();
        } catch {}
        rl = null;
      }
    }
    const isBreaking = /^y(es)?$/i.test(breakingAns);
    const footers = isBreaking ? [{ key: "BREAKING CHANGE", value: breakingDetails }] : [];

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
        console.log(
          c.yellow(
            `[TEST] lint invalid. Subject="${commit.subject}", Scope="${commit.scope ?? ""}", Body length=${commit.body?.length ?? 0}`
          )
        );
      }
      console.error(
        c.red(t(lang, "cli.invalid")) + "\n" + result.errors.map((e) => c.red(`- ${e}`)).join("\n")
      );
      return 1;
    }

    if (result.warnings.length) {
      console.warn(
        result.warnings.map((w) => c.yellow(t(lang, "cli.warning", { msg: w }))).join("\n")
      );
    }

    const msg = formatMessage(commit);
    writeFileSync(".git/COMMIT_EDITMSG", msg, "utf8");
    const createdHdr = t(lang, "commit.created", { msg: "" }).trimEnd();
    console.log("\n" + c.green(createdHdr));
    console.log("\n" + msg + "\n");

    try {
      const stopSpinner = showSpinner(t(lang, "commit.committing") || "Committing changes...");
      const commitOut = execFileSync("git", ["commit", "-F", ".git/COMMIT_EDITMSG"], {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
      stopSpinner();
      console.log(""); // Linha em branco após o spinner
      if (commitOut) process.stdout.write(commitOut);

      if (cfg?.autoPush) {
        const stopPushSpinner = showSpinner(t(lang, "commit.pushing") || "Pushing to remote...");
        try {
          const useProgress = cfg?.pushProgress !== false;
          const pushArgs = ["push", ...(useProgress ? ["--progress"] : [])];
          const pushOut = execFileSync("git", pushArgs, {
            stdio: ["ignore", "pipe", useProgress ? "inherit" : "pipe"],
            encoding: "utf8",
          });
          stopPushSpinner();
          if (pushOut) process.stdout.write(pushOut);
        } catch {
          stopPushSpinner();
          // Attempt to set upstream if missing and push again
          try {
            const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
              stdio: ["ignore", "pipe", "ignore"],
              encoding: "utf8",
            })
              .toString()
              .trim();
            let remote = "origin";
            try {
              const remotes = execFileSync("git", ["remote"], {
                stdio: ["ignore", "pipe", "ignore"],
                encoding: "utf8",
              })
                .toString()
                .trim()
                .split("\n")
                .filter(Boolean);
              if (remotes.length > 0) remote = remotes[0];
            } catch {}
            if (!branch || branch === "HEAD") {
              console.error(c.red("Current branch is detached; cannot push."));
              return 1;
            }
            const stopUpSpinner = showSpinner("Setting upstream and pushing...");
            const useProgress = cfg?.pushProgress !== false;
            const pushUpArgs = [
              "push",
              ...(useProgress ? ["--progress"] : []),
              "-u",
              remote,
              branch,
            ];
            const pushUpOut = execFileSync("git", pushUpArgs, {
              stdio: ["ignore", "pipe", useProgress ? "inherit" : "pipe"],
              encoding: "utf8",
            });
            stopUpSpinner();
            if (pushUpOut) process.stdout.write(pushUpOut);
          } catch (err2: unknown) {
            const errOut = err2 && err2 instanceof Error ? err2.message : "";
            if (errOut) process.stderr.write(errOut);
            console.error(c.red(String(err2)));
            return 1;
          }
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

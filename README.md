# CommitZero

[![npm version](https://img.shields.io/npm/v/@codemastersolutions/commitzero.svg?logo=npm&label=npm)](https://www.npmjs.com/package/@codemastersolutions/commitzero)
[![npm downloads](https://img.shields.io/npm/dm/@codemastersolutions/commitzero.svg?logo=npm)](https://www.npmjs.com/package/@codemastersolutions/commitzero)
[![license](https://img.shields.io/npm/l/@codemastersolutions/commitzero.svg)](https://opensource.org/licenses/MIT)
![node >=16](https://img.shields.io/badge/node-%3E%3D16-339933?logo=node.js)
[![CI](https://github.com/codemastersolutions/commitzero/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/codemastersolutions/commitzero/actions/workflows/ci.yml)
[![CodeQL](https://github.com/codemastersolutions/commitzero/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/codemastersolutions/commitzero/actions/workflows/codeql.yml)

Languages: English | [Português 🇧🇷](./README.pt-BR.md) | [Español](./README.es.md)

Conventional Commits validator with a friendly CLI, Git hooks, and an internal rule engine — zero runtime dependencies.

## Features

- Zero runtime dependencies; lightweight and fast.
- Friendly CLI with interactive commit flow.
- Git hooks install/uninstall with versioned hooks path (`.commitzero/hooks`).
- Internal rules engine enforcing Conventional Commits.
- Internationalization: `en`, `pt-BR`, `es`.
- Pre-commit commands runner and management.

## Installation

- Local project (dev dependency):

```sh
npm i -D @codemastersolutions/commitzero
# or
pnpm add -D @codemastersolutions/commitzero
# or
yarn add -D @codemastersolutions/commitzero
```

- One-off run (no install):

```sh
npx commitzero --help
```

## Quickstart

- Initialize configuration: `commitzero init`
- Install versioned hooks: `commitzero install-hooks`
- Make an interactive commit: `commitzero commit`
  - Auto stage: `commitzero commit -a`
  - Push after commit: `commitzero commit -p` (disable progress with `--progress-off`)
  - Use main buffer instead of alternate screen: `commitzero commit --no-alt-screen`
  - Set pre-commit timeout: `commitzero commit -t 2m` (or `--timeout 120s`)

## CLI Usage

- Help: `commitzero --help`
- Initialize config: `commitzero init`
- Lint a message:
  - From file: `commitzero lint --file tmp/commit.txt`
  - From argument: `commitzero lint -m "feat(core): add x"`
- Validate current commit (hook): `commitzero check`
- Hooks: `commitzero install-hooks` / `commitzero uninstall-hooks`
  - Options:
    - `--force`: Override existing hooks path configuration
    - `--init-git`: Initialize git repository if not already initialized
- Pre-commit commands management:
  - Add: `commitzero pre-commit add "npm run lint"`
  - Remove: `commitzero pre-commit remove "npm run lint"`
- Interactive commit: `commitzero commit`
  - Auto stage changes: `commitzero commit -a` or `commitzero commit --add`
  - Commit and push: `commitzero commit -p` or `commitzero commit --push`
  - Disable push progress animation: `commitzero commit --progress-off`
  - Disable alternate screen (use main buffer): `commitzero commit --no-alt-screen`

### Interactive commit: navigation and display

- Navigate with `↑`/`↓` or `j`/`k` (wrap-around).
- Confirm with `Enter`. Cancel with `Ctrl+C`.
- Uses the terminal’s alternate screen by default for stable pagination.
- Opt-out via `--no-alt-screen` or set `uiAltScreen: false` in config.

## Special notes

### If command `commitzero` return not found, use a package manager to run it. This is because it is a development dependency and some package managers do not install the executable globally.

```sh
# npm
npm run commitzero --help
# or
# pnpm
pnpm commitzero --help
# or
# yarn
yarn commitzero --help
```

### If you're using Windows

- The hooks must be runnable in Git Bash.
- Pre-commit commands must be runnable in Git Bash.

### Hook installation example

#### Initialize a git repository

```sh
git init
```

#### Install commit hooks

The hooks are automatically installed in `.commitzero/hooks` directory and Git is configured to use this path. This ensures hooks are version controlled.

```sh
commitzero install-hooks
# or
npm run commitzero install-hooks
# or
pnpm commitzero install-hooks
# or
yarn commitzero install-hooks
```

**Options:**

- `--force`: Override existing hooks path configuration without confirmation
- `--init-git`: Initialize git repository if not already initialized

**Interactive prompts:**

- If Git is not initialized, you'll be prompted to initialize it
- If a different hooks path is already configured, you'll be asked to confirm overriding it

#### Check commit hooks

```sh
ls -l .commitzero/hooks/commit-msg
# Should be executable and include the CommitZero-managed block
```

## Multi-line messages

- Prefer `--file` for messages with body/footers:

```sh
printf "feat(core): change\n\nBody text\n\nRefs: 123" > tmp/commit.txt

commitzero lint --file tmp/commit.txt
# or
npm run commitzero lint --file tmp/commit.txt
# or
pnpm commitzero lint --file tmp/commit.txt
# or
yarn commitzero lint --file tmp/commit.txt
```

- Alternative with `$'...'` to expand `\n` in the shell:

```sh
commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# or
npm run commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# or
pnpm commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# or
yarn commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
```

## Core rules

- `type` must be valid and lowercase.
- `scope` optional; when present, must be lowercase and only `a-z`, `0-9`, `-`, space.
- `subject` must not end with `.` and respects a configurable limit.
- Blank line required between header and body (if body present).
- Blank line required before footers (if footers present).
- `feat!`/breaking requires `BREAKING CHANGE: ...` footer.

## Configuration

- `commitzero.config.json|js` (optional):
  - Defines rules, language, hooks, and pre-commit commands used by the CLI.

### Full example

```json
{
  "types": [
    "feat",
    "fix",
    "docs",
    "style",
    "refactor",
    "perf",
    "test",
    "build",
    "ci",
    "chore",
    "revert"
  ],
  "scopes": [],
  "requireScope": false,
  "maxSubjectLength": 72,
  "allowBreaking": true,
  "footerKeywords": ["BREAKING CHANGE", "Closes", "Refs"],
  "preCommitCommands": [],
  "preCommitTimeout": "3m",
  "language": "en",
  "uiAltScreen": true
}
```

### Properties

- `types`: Allowed commit types following Conventional Commits.
- `scopes`: Allowed scopes. Empty array means any lowercase scope is accepted.
- `requireScope`: When `true`, a scope must be provided.
- `maxSubjectLength`: Maximum characters allowed in the commit subject.
- `allowBreaking`: When `false`, disallows `feat!` and requires `BREAKING CHANGE` footer when breaking changes are present.
- `footerKeywords`: Keywords recognized as commit footers (e.g., references, breaking changes).
- `preCommitCommands`: Array of shell commands to run before committing.
- `preCommitTimeout`: Timeout for each pre-commit command. Accepts a number (ms) or duration string (`"90s"`, `"2m"`, `"1500ms"`). Default: `"3m"`.
- `language`: CLI and rules output language. Accepted values: `en`, `pt`, `es`. Default: `en`.
- `uiAltScreen`: When `true`, interactive prompts render in the terminal's alternate screen for stable display. Disable with `--no-alt-screen` or set to `false`.

### Environment variables

- `COMMITZERO_LANG`: Override language (`en`, `pt`, `es`).
- `NO_ALT_SCREEN=1`: Disable alternate screen for interactive prompts.
- `COMMITZERO_PRE_COMMIT_TIMEOUT`: Timeout for pre-commit commands. E.g., `"2m"`, `"120s"`, `"5000ms"`. Takes precedence over config.

### Hooks path

- Respects Git `core.hooksPath` if configured.
- Defaults to `.git/hooks` when `core.hooksPath` is not set.
- `commitzero install-hooks` configures `core.hooksPath` to `.commitzero/hooks` so hooks are version controlled in the repo.

### Commands that populate `preCommitCommands`

- Add a command:

```sh
commitzero pre-commit add "npm run lint"
# or
npm run commitzero pre-commit add "npm run lint"
# or
pnpm commitzero pre-commit add "npm run lint"
# or
yarn commitzero pre-commit add "npm run lint"
```

- Remove a command:

```sh
commitzero pre-commit remove "npm run lint"
# or
npm run commitzero pre-commit remove "npm run lint"
# or
pnpm commitzero pre-commit remove "npm run lint"
# or
yarn commitzero pre-commit remove "npm run lint"
```

Tip: keep `preCommitCommands` as an empty array if you don't need pre-commit checks.

## Compatibility

- Node >= 16 (CLI/tests prefer Node >= 18).

## Contributing

- Keep all language READMEs in sync:
  - Source: `README.md` (English)
  - Mirrors: `README.pt-BR.md`, `README.es.md`
- When updating docs, edit English first and replicate the change:
  - Apply the same structure, headings, and examples.
  - Keep the language switcher links at the top accurate.
- Prefer small iterative changes to ease translation review.

## Documentation PR Checklist

- Language links present and correct at the top.
- Command examples run as written: paths, quotes, `$'...'` expansion, file creation, hook install.
- Headings and terminology consistent across all languages.
- Changes replicated to `README.pt-BR.md` and `README.es.md`.
- Run `npm run build` and `npm test` if CLI examples or syntax changed.
- Update integration tests when documented behavior changes.
- Node version notes remain accurate.

### Removing hooks

- On uninstall, CommitZero attempts to remove its managed block from Git hooks automatically.
- If your package manager does not run `postuninstall`, remove lines between `# CommitZero managed block START` and `# CommitZero managed block END` in:
  - `.commitzero/hooks/commit-msg` or `.git/hooks/commit-msg`
  - `.commitzero/hooks/prepare-commit-msg` or `.git/hooks/prepare-commit-msg`
- Or run manually:

```sh
commitzero cleanup
# or
npm run commitzero cleanup
# or
pnpm commitzero cleanup
# or
yarn commitzero cleanup
```

Note: uninstall-hooks and cleanup do not remove `package.json` scripts. The scripts `commitzero`, `commitzero:install`, and `commitzero:uninstall` are preserved for convenience.

### Hook language

- Hooks print guidance messages in your language when CommitZero is missing.
- Detection order:
  - `commitzero.config.json` `language`
  - `COMMITZERO_LANG` environment variable (`en`, `pt`, `es`)
  - OS locale (`LANG`), mapping `pt_BR*` → `pt`, `es_*` → `es`, others → `en`.
- Example override per repo:

```sh
export COMMITZERO_LANG=es
```

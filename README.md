# CommitZero

Languages: English | [Português Brasil](./README.pt-BR.md) | [Español](./README.es.md)

Conventional Commits validator with a friendly CLI, Git hooks, and an internal rule engine — zero runtime dependencies.

## Installation

- Local project (dev dependency):
- `npm i -D @codemastersolutions/commitzero`
- `pnpm add -D @codemastersolutions/commitzero`
- `yarn add -D @codemastersolutions/commitzero`

- One-off run (no install):
  - `npx commitzero --help`

## CLI Usage

- Help: `commitzero --help`
- Initialize config: `commitzero init`
- Lint a message:
  - From file: `commitzero lint --file tmp/commit.txt`
  - From argument: `commitzero lint -m "feat(core): add x"`
- Validate current commit (hook): `commitzero check`
- Hooks: `commitzero install-hooks` / `commitzero uninstall-hooks`
- Interactive commit: `commitzero commit`
  - Auto stage changes: `commitzero commit -a` or `commitzero commit --add`
  - Commit and push: `commitzero commit -p` or `commitzero commit --push`

### Hook installation example

```
git init
commitzero install-hooks
ls -l .git/hooks/commit-msg
# Should be executable and include the CommitZero-managed block
```

## Multi-line messages

- Prefer `--file` for messages with body/footers:

```
printf "feat(core): change\n\nBody text\n\nRefs: 123" > tmp/commit.txt
commitzero lint --file tmp/commit.txt
```

- Alternative with `$'...'` to expand `\n` in the shell:

```
commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
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
  - `types`, `scopes`, `maxSubjectLength`, `requireScope`, `allowBreaking`, `footerKeywords`, `hookInstallPath`, `language`.

- `language` controls the CLI and rule output language. Accepted values: `en`, `pt`, `es`. Default: `en`.
- Example:

```
{
  "language": "pt"
}
```

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

## Publishing (maintainers)

- Package is scoped as `@codemastersolutions/commitzero`.
- Scoped packages require an npm organization for the scope (`@codemastersolutions`). Ensure the org exists and your account has publish rights.
- Set `publishConfig.access` to `public` (already configured).
- In CI, provide `NPM_TOKEN` with publish permission to the package/org. The workflow uses `NODE_AUTH_TOKEN` from this secret.
- Releases run only after a PR to `main` is merged; versioning and `npm publish` are handled in the GitHub Actions workflow.
### Removing hooks

- On uninstall, CommitZero attempts to remove its managed block from Git hooks automatically.
- If your package manager does not run `postuninstall`, remove lines between `# CommitZero managed block START` and `# CommitZero managed block END` in:
  - `.git/hooks/commit-msg`
  - `.git/hooks/prepare-commit-msg`
- Or run manually:

```
node ./node_modules/@codemastersolutions/commitzero/dist/cjs/hooks/cleanup.js
```
### Hook language

- Hooks print guidance messages in your language when CommitZero is missing.
- Detection order:
  - `commitzero.config.json` `language`
  - `COMMITZERO_LANG` environment variable (`en`, `pt`, `es`)
  - OS locale (`LANG`), mapping `pt_*` → `pt`, `es_*` → `es`, others → `en`.
- Example override per repo:

```
export COMMITZERO_LANG=es
```
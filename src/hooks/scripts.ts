export const HOOK_HEADER = "# CommitZero managed block";

export function commitMsgScript(): string {
  return `#!/bin/sh\nset -eu\n${HOOK_HEADER} START\n# Validate commit message using CommitZero\nif [ -x "./node_modules/.bin/commitzero" ]; then\n  ./node_modules/.bin/commitzero check\nelif [ -f "./node_modules/@codemastersolutins/commitzero/dist/cjs/cli/index.js" ]; then\n  node ./node_modules/@codemastersolutins/commitzero/dist/cjs/cli/index.js check\nelse\n  echo "CommitZero not found. Install with 'npm i -D @codemastersolutins/commitzero'" 1>&2\n  exit 1\nfi\n${HOOK_HEADER} END\n`;
}

export function prepareCommitMsgScript(): string {
  return `#!/bin/sh\nset -eu\n${HOOK_HEADER} START\n# prepare-commit-msg hook (placeholder)\n# Keeps default behavior; may pre-fill templates in the future.\n${HOOK_HEADER} END\n`;
}
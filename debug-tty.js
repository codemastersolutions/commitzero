#!/usr/bin/env node

console.log('=== DEBUG TTY ===');
console.log('process.stdin.isTTY:', !!process.stdin.isTTY);
console.log('process.stdout.isTTY:', !!process.stdout.isTTY);
console.log('process.stderr.isTTY:', !!process.stderr.isTTY);
console.log('process.env.CI:', process.env.CI);
console.log('process.env.NODE_TEST:', process.env.NODE_TEST);
console.log('process.env.COMMITSKIP_INPUT_PROMPT:', process.env.COMMITSKIP_INPUT_PROMPT);
console.log('process.env.COMMITZERO_TEST_ANSWERS:', process.env.COMMITZERO_TEST_ANSWERS);

const forceNonInteractive =
  process.env.COMMITSKIP_INPUT_PROMPT === "1" ||
  process.env.CI === "true" ||
  process.env.NODE_TEST === "1";

const isInteractive = !!process.stdin.isTTY && !forceNonInteractive;

console.log('forceNonInteractive:', forceNonInteractive);
console.log('isInteractive:', isInteractive);

if (isInteractive) {
  console.log('✅ Modo interativo ativado - contadores devem aparecer');
} else {
  console.log('❌ Modo não-interativo - contadores NÃO aparecerão');
}
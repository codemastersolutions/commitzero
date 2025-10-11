#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function log(step) {
  console.log(`\n==> ${step}`);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { bump: null, ignoreReadmes: false, dryPublish: true };
  for (const a of args) {
    if (['patch', 'minor', 'major'].includes(a)) opts.bump = a;
    if (a === '--ignore-readmes') opts.ignoreReadmes = true;
    if (a === '--no-dry-publish') opts.dryPublish = false;
  }
  if (!opts.bump) {
    console.error('Uso: node scripts/simulate-release.js <patch|minor|major> [--ignore-readmes] [--no-dry-publish]');
    process.exit(1);
  }
  return opts;
}

function readVersion() {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  return pkg.version;
}

function bumpVersion(v, type) {
  const [maj, min, pat] = v.split('.').map(Number);
  if (type === 'patch') return `${maj}.${min}.${pat + 1}`;
  if (type === 'minor') return `${maj}.${min + 1}.0`;
  if (type === 'major') return `${maj + 1}.0.0`;
  return v;
}

async function main() {
  const { bump, ignoreReadmes, dryPublish } = parseArgs();
  log('Instalando dependências (npm ci)');
  run('npm ci');

  if (!ignoreReadmes) {
    log('Verificando READMEs (npm run verify:readmes)');
    try {
      run('npm run verify:readmes');
    } catch (e) {
      console.error('\nFalha na verificação dos READMEs — simulação interrompida.');
      process.exit(1);
    }
  } else {
    log('Ignorando verificação dos READMEs por opção');
  }

  log('Executando testes (npm test)');
  run('npm test');

  log('Build (npm run build)');
  run('npm run build');

  const current = readVersion();
  const next = bumpVersion(current, bump);
  log(`Simulando incremento de versão: v${current} -> v${next}`);
  console.log('Nota: nenhum arquivo foi alterado nesta simulação.');

  log('Simulando push de mudanças e tags');
  console.log('Simulação: git push --follow-tags');

  log('Simulando criação de Release no GitHub');
  console.log(`Simulação: criar release para tag v${next}`);

  log(`Simulando publicação no npm (${dryPublish ? 'dry-run' : 'real'})`);
  const publishCmd = `npm publish --access public ${dryPublish ? '--dry-run' : ''}`.trim();
  try {
    run(publishCmd);
  } catch (e) {
    console.error('\nPublicação (simulada) falhou. Verifique o conteúdo que será publicado.');
    process.exit(1);
  }

  console.log('\nSimulação concluída com sucesso.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
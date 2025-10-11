#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const files = {
  en: path.join(root, 'README.md'),
  pt: path.join(root, 'README.pt-BR.md'),
  es: path.join(root, 'README.es.md'),
};

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read file: ${file}`);
  }
}

function checkLinks(content, lang) {
  const results = [];
  if (lang === 'en') {
    results.push(/\(\.\/README\.pt-BR\.md\)/.test(content));
    results.push(/\(\.\/README\.es\.md\)/.test(content));
    results.push(/Languages:\s*English\s*\|/i.test(content));
  } else if (lang === 'pt') {
    results.push(/\(\.\/README\.md\)/.test(content));
    results.push(/\(\.\/README\.es\.md\)/.test(content));
    results.push(/Idiomas:\s*\[English\]/i.test(content));
  } else if (lang === 'es') {
    results.push(/\(\.\/README\.md\)/.test(content));
    results.push(/\(\.\/README\.pt-BR\.md\)/.test(content));
    results.push(/Idiomas:\s*\[English\]/i.test(content));
  }
  return results.every(Boolean);
}

function checkSectionsOrder(content, titles) {
  const indexes = titles.map(t => content.indexOf(t));
  if (indexes.some(i => i === -1)) return false;
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] <= indexes[i - 1]) return false;
  }
  return true;
}

function checkPatterns(content, patterns) {
  return patterns.every(re => re.test(content));
}

const configs = {
  en: {
    sections: [
      '## Installation',
      '## CLI Usage',
      '## Multi-line messages',
      '## Core rules',
      '## Configuration',
      '## Compatibility',
      '## Contributing',
      '## Documentation PR Checklist',
    ],
    patterns: [
      /lint --file/, // multi-line via file
      /lint -m \$'feat\(core\): change\\n\\nBody text/, // argument with $'...'
      /install-hooks/, // hooks example
      /Node >= 16/, // node version note
    ],
  },
  pt: {
    sections: [
      '## Instalação',
      '## Uso do CLI',
      '## Mensagens multi-linha',
      '## Regras principais',
      '## Configuração',
      '## Compatibilidade',
      '## Contribuindo',
      '## Checklist para PRs de documentação',
    ],
    patterns: [
      /lint --file/,
      /lint -m \$'feat\(core\): change\\n\\nBody text/,
      /install-hooks/,
      /Node >= 16/,
    ],
  },
  es: {
    sections: [
      '## Instalación',
      '## Uso del CLI',
      '## Mensajes multi-línea',
      '## Reglas principales',
      '## Configuración',
      '## Compatibilidad',
      '## Contribuyendo',
      '## Checklist para PRs de documentación',
    ],
    patterns: [
      /lint --file/,
      /lint -m \$'feat\(core\): change\\n\\nBody text/,
      /install-hooks/,
      /Node >= 16/,
    ],
  },
};

let ok = true;

for (const [lang, file] of Object.entries(files)) {
  const content = read(file);
  const cfg = configs[lang];
  const linksOk = checkLinks(content, lang);
  const sectionsOk = checkSectionsOrder(content, cfg.sections);
  const patternsOk = checkPatterns(content, cfg.patterns);

  if (!linksOk || !sectionsOk || !patternsOk) {
    ok = false;
    console.error(`README check failed for ${path.basename(file)}:`);
    if (!linksOk) console.error('- Missing or incorrect language links at top');
    if (!sectionsOk) console.error('- Sections missing or out of order');
    if (!patternsOk) console.error('- Required examples/patterns missing');
  }
}

if (!ok) {
  process.exitCode = 1;
  console.error('README verification failed.');
} else {
  console.log('All README files verified successfully.');
}
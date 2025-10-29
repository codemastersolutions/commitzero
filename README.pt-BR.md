# CommitZero

[![npm versão](https://img.shields.io/npm/v/@codemastersolutions/commitzero.svg?logo=npm&label=npm)](https://www.npmjs.com/package/@codemastersolutions/commitzero)
[![downloads npm](https://img.shields.io/npm/dm/@codemastersolutions/commitzero.svg?logo=npm)](https://www.npmjs.com/package/@codemastersolutions/commitzero)
[![licença](https://img.shields.io/npm/l/@codemastersolutions/commitzero.svg)](https://opensource.org/licenses/MIT)
![node >=16](https://img.shields.io/badge/node-%3E%3D16-339933?logo=node.js)
[![CI](https://github.com/codemastersolutions/commitzero/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/codemastersolutions/commitzero/actions/workflows/ci.yml)
[![CodeQL](https://github.com/codemastersolutions/commitzero/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/codemastersolutions/commitzero/actions/workflows/codeql.yml)

Idiomas: [English](./README.md) | Português Brasil | [Español](./README.es.md)

Validador de Conventional Commits com uma CLI amigável, hooks Git e motor de regras interno — sem dependências de runtime.

## Instalação

- Projeto local (dependência de desenvolvimento):

```sh
npm i -D @codemastersolutions/commitzero
# ou
pnpm add -D @codemastersolutions/commitzero
# ou
yarn add -D @codemastersolutions/commitzero
```

- Execução pontual (sem instalar):

```sh
npx commitzero --help
```

## Uso do CLI

- Ajuda: `commitzero --help`
- Inicializar config: `commitzero init`
- Lint de mensagem:
  - Via arquivo: `commitzero lint --file tmp/commit.txt`
  - Via argumento: `commitzero lint -m "feat(core): add x"`
- Validar commit corrente (hook): `commitzero check`
- Hooks: `commitzero install-hooks` / `commitzero uninstall-hooks`
  - Opções:
    - `--force`: Sobrescrever configuração de caminho de hooks existente
    - `--init-git`: Inicializar repositório git se ainda não inicializado
- Gestão de comandos de pre-commit:
  - Adicionar: `commitzero pre-commit add "npm run lint"`
  - Remover: `commitzero pre-commit remove "npm run lint"`
- Commit interativo: `commitzero commit`
  - Adicionar mudanças automaticamente: `commitzero commit -a` ou `commitzero commit --add`
  - Commit e push: `commitzero commit -p` ou `commitzero commit --push`

## Notas especiais

### Se o comando `commitzero` retornar não encontrado, use um gerenciador de pacotes para executá-lo. Isso ocorre porque é uma dependência de desenvolvimento e alguns gerenciadores de pacotes não instalam o executável globalmente.

```sh
# npm
npm run commitzero --help
# ou
# pnpm
pnpm commitzero --help
# ou
# yarn
yarn commitzero --help
```

### Se você estiver usando Windows

- Os hooks devem ser executáveis no Git Bash.
- Os comandos de pre-commit devem ser executáveis no Git Bash.

### Exemplo de instalação de hooks

#### Inicializar um repositório git

```sh
git init
```

#### Instalar hooks de commit

Os hooks são automaticamente instalados no diretório `.commitzero/hooks` e o Git é configurado para usar este caminho. Isso garante que os hooks sejam versionados.

```sh
commitzero install-hooks
# ou
npm run commitzero install-hooks
# ou
pnpm commitzero install-hooks
# ou
yarn commitzero install-hooks
```

**Opções:**
- `--force`: Sobrescrever configuração de caminho de hooks existente sem confirmação
- `--init-git`: Inicializar repositório git se ainda não inicializado

**Prompts interativos:**
- Se o Git não estiver inicializado, você será solicitado a inicializá-lo
- Se um caminho de hooks diferente já estiver configurado, você será perguntado para confirmar a sobrescrita

#### Verificar hooks de commit

```sh
ls -l .commitzero/hooks/commit-msg
# Deve estar executável e incluir o bloco gerenciado pelo CommitZero
```

## Mensagens multi-linha

- Prefira `--file` para mensagens com body/footers:

```sh
printf "feat(core): change\n\nBody text\n\nRefs: 123" > tmp/commit.txt
commitzero lint --file tmp/commit.txt
# ou
npm run commitzero lint --file tmp/commit.txt
# ou
pnpm commitzero lint --file tmp/commit.txt
# ou
yarn commitzero lint --file tmp/commit.txt
```

- Alternativa com `$'...'` para expandir `\n` no shell:

```sh
commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# ou
npm run commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# ou
pnpm commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# ou
yarn commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
```

## Regras principais

- `type` deve ser válido e minúsculo.
- `scope` opcional; quando presente, deve ser minúsculo e conter apenas `a-z`, `0-9`, `-`, espaço.
- `subject` não pode terminar com `.` e respeita limite configurável.
- Linha em branco obrigatória entre header e body (se houver body).
- Linha em branco obrigatória antes dos footers (se houver footers).
- `feat!`/breaking exige footer `BREAKING CHANGE: ...`.

## Configuração

- `commitzero.config.json|js` (opcional):
  - Define regras, idioma, hooks e comandos de pre-commit usados pela CLI.

### Exemplo completo

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
  "language": "en"
}
```

### Propriedades

- `types`: Tipos de commit permitidos seguindo Conventional Commits.
- `scopes`: Escopos permitidos. Array vazio significa que qualquer escopo minúsculo é aceito.
- `requireScope`: Quando `true`, um escopo deve ser informado.
- `maxSubjectLength`: Número máximo de caracteres no assunto do commit.
- `allowBreaking`: Quando `false`, não permite `feat!` e exige footer `BREAKING CHANGE` quando houver breaking changes.
- `footerKeywords`: Palavras-chave reconhecidas como footers de commit (ex.: referências, breaking changes).
- `preCommitCommands`: Array de comandos de shell para rodar antes do commit.
- `language`: Idioma de saída da CLI e das regras. Valores aceitos: `en`, `pt`, `es`. Padrão: `en`.

### Caminho dos hooks

- Respeita a configuração do Git `core.hooksPath`, quando presente.
- Usa `.git/hooks` por padrão quando `core.hooksPath` não está configurado.
- `commitzero install-hooks` configura `core.hooksPath` para `.commitzero/hooks` para que os hooks sejam versionados no repositório.

### Comandos que alimentam `preCommitCommands`

- Adicionar um comando:

```sh
commitzero pre-commit add "npm run lint"
# ou
npm run commitzero pre-commit add "npm run lint"
# ou
pnpm commitzero pre-commit add "npm run lint"
# ou
yarn commitzero pre-commit add "npm run lint"
```

- Remover um comando:

```sh
commitzero pre-commit remove "npm run lint"
# ou
npm run commitzero pre-commit remove "npm run lint"
# ou
pnpm commitzero pre-commit remove "npm run lint"
# ou
yarn commitzero pre-commit remove "npm run lint"
```

Dica: mantenha `preCommitCommands` como um array vazio se não precisar de checagens de pre-commit.

## Compatibilidade

- Node >= 16 (CLI/testes preferem Node >= 18).

## Contribuindo

- Mantenha os READMEs de idiomas sincronizados:
  - Fonte: `README.md` (English)
  - Espelhos: `README.pt-BR.md`, `README.es.md`
- Ao atualizar a documentação, edite primeiro em inglês e replique a mudança:
  - Aplique mesma estrutura, títulos e exemplos.
  - Mantenha os links de idiomas no topo corretos.
- Prefira mudanças pequenas e iterativas para facilitar revisão.

## Checklist para PRs de documentação

- Links de idiomas presentes e corretos no topo.
- Exemplos de comandos executam como descritos: paths, aspas, expansão de `$'...'`, criação de arquivo, instalação de hook.
- Títulos e termos consistentes entre todos os idiomas.
- Mudanças replicadas em `README.pt-BR.md` e `README.es.md`.
- Execute `npm run build` e `npm test` se exemplos do CLI ou sintaxe mudaram.
- Atualize testes de integração quando o comportamento documentado mudar.
- Notas de versão do Node permanecem corretas.

### Remoção de hooks

- Ao desinstalar, o CommitZero tenta remover automaticamente o bloco gerenciado dos hooks do Git.
- Se o gerenciador de pacotes não executar `postuninstall`, remova as linhas entre `# CommitZero managed block START` e `# CommitZero managed block END` em:
  - `.git/hooks/commit-msg`
  - `.git/hooks/prepare-commit-msg`
- Ou execute manualmente:

```sh
commitzero cleanup
# ou
npm run commitzero cleanup
# ou
pnpm commitzero cleanup
# ou
yarn commitzero cleanup
```

### Idioma dos hooks

- Os hooks imprimem mensagens de orientação no seu idioma quando o CommitZero está ausente.
- Ordem de detecção:
  - `language` em `commitzero.config.json`
  - Variável de ambiente `COMMITZERO_LANG` (`en`, `pt`, `es`)
  - Locale do SO (`LANG`), mapeando `pt_BR*` → `pt`, `es_*` → `es`, demais → `en`.
- Exemplo de override por repositório:

```sh
export COMMITZERO_LANG=pt
```

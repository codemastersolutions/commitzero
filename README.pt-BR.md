# CommitZero

Idiomas: [English](./README.md) | Português Brasil | [Español](./README.es.md)

Validador de Conventional Commits com uma CLI amigável, hooks Git e motor de regras interno — sem dependências de runtime.

## Instalação

- Projeto local (dependência de desenvolvimento):
- `npm i -D @codemastersolutions/commitzero`
- `pnpm add -D @codemastersolutions/commitzero`
- `yarn add -D @codemastersolutions/commitzero`

- Execução pontual (sem instalar):
  - `npx commitzero --help`

## Uso do CLI

- Ajuda: `commitzero --help`
- Inicializar config: `commitzero init`
- Lint de mensagem:
  - Via arquivo: `commitzero lint --file tmp/commit.txt`
  - Via argumento: `commitzero lint -m "feat(core): add x"`
- Validar commit corrente (hook): `commitzero check`
- Hooks: `commitzero install-hooks` / `commitzero uninstall-hooks`
- Commit interativo: `commitzero commit`
  - Adicionar mudanças automaticamente: `commitzero commit -a` ou `commitzero commit --add`
  - Commit e push: `commitzero commit -p` ou `commitzero commit --push`

### Exemplo de instalação de hooks

```
git init
commitzero install-hooks
ls -l .git/hooks/commit-msg
# Deve estar executável e conter o bloco gerenciado pelo CommitZero
```

## Mensagens multi-linha

- Prefira `--file` para mensagens com body/footers:

```
printf "feat(core): change\n\nBody text\n\nRefs: 123" > tmp/commit.txt
commitzero lint --file tmp/commit.txt
```

- Alternativa com `$'...'` para expandir `\n` no shell:

```
commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
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
  - `types`, `scopes`, `maxSubjectLength`, `requireScope`, `allowBreaking`, `footerKeywords`, `hookInstallPath`, `language`.

- `language` define o idioma de saída do CLI e das regras. Valores aceitos: `en`, `pt`, `es`. Padrão: `en`.
- Exemplo:

```
{
  "language": "pt"
}
```

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
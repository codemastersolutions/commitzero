export type Lang = "en" | "pt" | "es";

export const DEFAULT_LANG: Lang = "en";

type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = {
  en: {
    // CLI
    "cli.help": "commitzero CLI\n\nCommands:\n  init\n  lint --file <path> | -m <message>\n  check\n  install-hooks\n  uninstall-hooks\n  commit [-a|--add] [-p|--push]\n\nOptions:\n  --help",
    "cli.provideInput": "Provide --file <path> or -m <message>",
    "cli.invalid": "Invalid commit:",
    "cli.warnings": "Warnings:",
    "cli.warning": "Warning: {msg}",
    "cli.valid": "Valid commit",
    "cli.readEditmsgError": "Could not read COMMIT_EDITMSG",
    "cli.hooksInstalled": "Hooks installed at .git/hooks",
    "cli.hooksRemoved": "Managed blocks removed from hooks",
    "cli.allowedTypes": "Allowed types: {types}",
    "cli.exampleValid": "Valid example: {example}",
    "cli.exampleSubject": "add feature",
    "cli.flagsOnlyWithCommit": "Flags -a/--add and -p/--push are only valid with the 'commit' subcommand.",

    // commit interactive
    "commit.select.type": "Select commit type:",
    "commit.library.header": "Library: {name}",
    "commit.chosen.type": "Chosen type: {type}",
    "commit.prompt.type": "Type ({types}): ",
    "commit.prompt.scope": "Scope (optional, empty for none): ",
    "commit.prompt.subject": "Subject (short, imperative): ",
    "commit.prompt.body": "Body (optional, multi-line not supported; press Enter to skip): ",
    "commit.prompt.breaking": "Breaking change? (y/N): ",
    "commit.created": "Commit message created at .git/COMMIT_EDITMSG:\n\n{msg}",
    "commit.git.askAdd": "No files are staged. Run 'git add -A' now? (y/N): ",
    "commit.git.abort": "Nothing to commit. Aborting.",
    "commit.cancelled": "Process cancelled by user.",

    // type descriptions
    "type.desc.feat": "A new feature",
    "type.desc.fix": "A bug fix",
    "type.desc.docs": "Documentation only changes",
    "type.desc.style": "Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)",
    "type.desc.refactor": "A code change that neither fixes a bug nor adds a feature",
    "type.desc.perf": "A code change that improves performance",
    "type.desc.test": "Adding missing tests or correcting existing tests",
    "type.desc.build": "Changes that affect the build system or external dependencies",
    "type.desc.ci": "Changes to CI configuration files and scripts",
    "type.desc.chore": "Other changes that don't modify src or test files",
    "type.desc.revert": "Reverts a previous commit",

    // init
    "init.exists": "commitzero.config.json already exists, nothing to do.",
    "init.created": "File commitzero.config.json created with defaults.",

    // Rules
    "rules.typeInvalid": "invalid type: {type}",
    "rules.typeLower": "type must be lowercase",
    "rules.scopeRequired": "scope is required",
    "rules.scopeInvalid": "invalid scope: {scope}",
    "rules.scopePattern": "scope must contain only a-z, 0-9, hyphen and space",
    "rules.scopeLower": "scope must be lowercase",
    "rules.subjectEmpty": "subject must not be empty",
    "rules.subjectTooLong": "subject exceeds {max} characters",
    "rules.subjectPeriod": "subject must not end with a period",
    "rules.blankHeaderBody": "blank line required between header and body",
    "rules.blankBeforeFooters": "blank line required before footers",
    "rules.breakingNotAllowed": "BREAKING CHANGE not allowed by configuration",
    "rules.breakingRequiresFooter": "BREAKING CHANGE requires 'BREAKING CHANGE' footer with details",
    "rules.footerUnknown": "unknown footer: {key}"
  },
  pt: {
    // CLI
    "cli.help": "commitzero CLI\n\nComandos:\n  init\n  lint --file <path> | -m <message>\n  check\n  install-hooks\n  uninstall-hooks\n  commit [-a|--add] [-p|--push]\n\nOpções:\n  --help",
    "cli.provideInput": "Forneça --file <path> ou -m <message>",
    "cli.invalid": "Commit inválido:",
    "cli.warnings": "Avisos:",
    "cli.warning": "Aviso: {msg}",
    "cli.valid": "Commit válido",
    "cli.readEditmsgError": "Não foi possível ler COMMIT_EDITMSG",
    "cli.hooksInstalled": "Hooks instalados em .git/hooks",
    "cli.hooksRemoved": "Blocos gerenciados removidos dos hooks",
    "cli.allowedTypes": "Tipos permitidos: {types}",
    "cli.exampleValid": "Exemplo válido: {example}",
    "cli.exampleSubject": "adicionar recurso",
    "cli.flagsOnlyWithCommit": "As flags -a/--add e -p/--push são válidas apenas com o subcomando 'commit'.",

    // commit interactive
    "commit.select.type": "Selecione o tipo de commit:",
    "commit.library.header": "Biblioteca: {name}",
    "commit.chosen.type": "Tipo escolhido: {type}",
    "commit.prompt.type": "Tipo ({types}): ",
    "commit.prompt.scope": "Escopo (opcional, vazio para nenhum): ",
    "commit.prompt.subject": "Assunto (curto, imperativo): ",
    "commit.prompt.body": "Corpo (opcional, multi-linha não suportado; enter para pular): ",
    "commit.prompt.breaking": "Breaking change? (y/N): ",
    "commit.created": "Mensagem de commit criada em .git/COMMIT_EDITMSG:\n\n{msg}",
    "commit.git.askAdd": "Nenhum arquivo está staged. Executar 'git add -A' agora? (y/N): ",
    "commit.git.abort": "Nada para cometer. Abortando.",
    "commit.cancelled": "Processo cancelado pelo usuário.",

    // type descriptions
    "type.desc.feat": "Uma nova funcionalidade",
    "type.desc.fix": "Correção de bug",
    "type.desc.docs": "Alterações apenas de documentação",
    "type.desc.style": "Alterações que não afetam o significado do código (espaços, formatação, ponto e vírgula, etc)",
    "type.desc.refactor": "Mudança de código que não corrige bug nem adiciona funcionalidade",
    "type.desc.perf": "Mudança de código que melhora desempenho",
    "type.desc.test": "Adicionar testes ausentes ou corrigir testes existentes",
    "type.desc.build": "Mudanças que afetam o sistema de build ou dependências externas",
    "type.desc.ci": "Mudanças na configuração e scripts de CI",
    "type.desc.chore": "Outras mudanças que não modificam arquivos de código ou testes",
    "type.desc.revert": "Reverte um commit anterior",

    // init
    "init.exists": "commitzero.config.json já existe, nada a fazer.",
    "init.created": "Arquivo commitzero.config.json criado com defaults.",

    // Rules
    "rules.typeInvalid": "type inválido: {type}",
    "rules.typeLower": "type deve ser minúsculo",
    "rules.scopeRequired": "scope é obrigatório",
    "rules.scopeInvalid": "scope inválido: {scope}",
    "rules.scopePattern": "scope deve conter apenas a-z, 0-9, hífen e espaço",
    "rules.scopeLower": "scope deve ser minúsculo",
    "rules.subjectEmpty": "subject não pode ser vazio",
    "rules.subjectTooLong": "subject excede {max} caracteres",
    "rules.subjectPeriod": "subject não deve terminar com ponto final",
    "rules.blankHeaderBody": "linha em branco requerida entre header e body",
    "rules.blankBeforeFooters": "linha em branco requerida antes dos footers",
    "rules.breakingNotAllowed": "BREAKING CHANGE não permitido pela configuração",
    "rules.breakingRequiresFooter": "BREAKING CHANGE requer footer 'BREAKING CHANGE' detalhando a mudança",
    "rules.footerUnknown": "footer desconhecido: {key}"
  },
  es: {
    // CLI
    "cli.help": "commitzero CLI\n\nComandos:\n  init\n  lint --file <path> | -m <message>\n  check\n  install-hooks\n  uninstall-hooks\n  commit [-a|--add] [-p|--push]\n\nOpciones:\n  --help",
    "cli.provideInput": "Proporciona --file <path> o -m <message>",
    "cli.invalid": "Commit inválido:",
    "cli.warnings": "Advertencias:",
    "cli.warning": "Advertencia: {msg}",
    "cli.valid": "Commit válido",
    "cli.readEditmsgError": "No se pudo leer COMMIT_EDITMSG",
    "cli.hooksInstalled": "Hooks instalados en .git/hooks",
    "cli.hooksRemoved": "Bloques gestionados eliminados de los hooks",
    "cli.allowedTypes": "Tipos permitidos: {types}",
    "cli.exampleValid": "Ejemplo válido: {example}",
    "cli.exampleSubject": "agregar funcionalidad",
    "cli.flagsOnlyWithCommit": "Las opciones -a/--add y -p/--push solo son válidas con el subcomando 'commit'.",

    // commit interactive
    "commit.select.type": "Selecciona el tipo de commit:",
    "commit.library.header": "Biblioteca: {name}",
    "commit.chosen.type": "Tipo elegido: {type}",
    "commit.prompt.type": "Tipo ({types}): ",
    "commit.prompt.scope": "Alcance (opcional, vacío para ninguno): ",
    "commit.prompt.subject": "Asunto (corto, imperativo): ",
    "commit.prompt.body": "Cuerpo (opcional, multi-línea no soportada; presiona Enter para omitir): ",
    "commit.prompt.breaking": "¿Cambio rompedor? (y/N): ",
    "commit.created": "Mensaje de commit creado en .git/COMMIT_EDITMSG:\n\n{msg}",
    "commit.git.askAdd": "No hay archivos staged. ¿Ejecutar 'git add -A' ahora? (y/N): ",
    "commit.git.abort": "Nada para commitear. Abortando.",
    "commit.cancelled": "Proceso cancelado por el usuario.",

    // type descriptions
    "type.desc.feat": "Nueva funcionalidad",
    "type.desc.fix": "Corrección de bug",
    "type.desc.docs": "Cambios solo de documentación",
    "type.desc.style": "Cambios que no afectan el significado del código (espacios, formato, punto y coma, etc)",
    "type.desc.refactor": "Cambio de código que no corrige un bug ni agrega funcionalidad",
    "type.desc.perf": "Cambio de código que mejora el rendimiento",
    "type.desc.test": "Añadir pruebas faltantes o corregir pruebas existentes",
    "type.desc.build": "Cambios que afectan el sistema de build o dependencias externas",
    "type.desc.ci": "Cambios en la configuración y scripts de CI",
    "type.desc.chore": "Otros cambios que no modifican archivos de código o pruebas",
    "type.desc.revert": "Revierte un commit previo",

    // init
    "init.exists": "commitzero.config.json ya existe, nada que hacer.",
    "init.created": "Archivo commitzero.config.json creado con valores por defecto.",

    // Rules
    "rules.typeInvalid": "tipo inválido: {type}",
    "rules.typeLower": "type debe estar en minúsculas",
    "rules.scopeRequired": "scope es obligatorio",
    "rules.scopeInvalid": "scope inválido: {scope}",
    "rules.scopePattern": "scope debe contener solo a-z, 0-9, guion y espacio",
    "rules.scopeLower": "scope debe estar en minúsculas",
    "rules.subjectEmpty": "subject no puede estar vacío",
    "rules.subjectTooLong": "subject excede {max} caracteres",
    "rules.subjectPeriod": "subject no debe terminar con punto final",
    "rules.blankHeaderBody": "línea en blanco requerida entre encabezado y cuerpo",
    "rules.blankBeforeFooters": "línea en blanco requerida antes de los footers",
    "rules.breakingNotAllowed": "BREAKING CHANGE no permitido por la configuración",
    "rules.breakingRequiresFooter": "BREAKING CHANGE requiere el footer 'BREAKING CHANGE' con detalles",
    "rules.footerUnknown": "footer desconocido: {key}"
  }
};

export function t(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const l = lang in dicts ? lang : DEFAULT_LANG;
  let s = dicts[l][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}
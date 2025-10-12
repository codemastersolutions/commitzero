# CommitZero

Idiomas: [English](./README.md) | [Português Brasil](./README.pt-BR.md) | Español

Validador de Conventional Commits con una CLI amigable, hooks de Git y un motor de reglas interno — sin dependencias de runtime.

## Instalación

- Proyecto local (dependencia de desarrollo):
- `npm i -D @codemastersolutions/commitzero`
- `pnpm add -D @codemastersolutions/commitzero`
- `yarn add -D @codemastersolutions/commitzero`

- Ejecución puntual (sin instalar):
  - `npx commitzero --help`

## Uso del CLI

- Ayuda: `commitzero --help`
- Inicializar configuración: `commitzero init`
- Lint de mensaje:
  - Vía archivo: `commitzero lint --file tmp/commit.txt`
  - Vía argumento: `commitzero lint -m "feat(core): add x"`
- Validar el commit actual (hook): `commitzero check`
- Hooks: `commitzero install-hooks` / `commitzero uninstall-hooks`
- Gestión de comandos de pre-commit:
  - Agregar: `commitzero pre-commit add "npm run lint"`
  - Quitar: `commitzero pre-commit remove "npm run lint"`
- Commit interactivo: `commitzero commit`
  - Agregar cambios automáticamente: `commitzero commit -a` o `commitzero commit --add`
  - Commit y push: `commitzero commit -p` o `commitzero commit --push`

### Ejemplo de instalación de hooks

```
git init
commitzero install-hooks
ls -l .git/hooks/commit-msg
# Debe ser ejecutable e incluir el bloque gestionado por CommitZero
```

## Mensajes multi-línea

- Prefiera `--file` para mensajes con body/footers:

```
printf "feat(core): change\n\nBody text\n\nRefs: 123" > tmp/commit.txt
commitzero lint --file tmp/commit.txt
```

- Alternativa con `$'...'` para expandir `\n` en el shell:

```
commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
```

## Reglas principales

- `type` debe ser válido y en minúsculas.
- `scope` opcional; cuando está presente, debe estar en minúsculas y contener solo `a-z`, `0-9`, `-`, espacio.
- `subject` no debe terminar con `.` y respeta un límite configurable.
- Línea en blanco obligatoria entre el header y el body (si hay body).
- Línea en blanco obligatoria antes de los footers (si hay footers).
- `feat!`/breaking requiere el footer `BREAKING CHANGE: ...`.

## Configuración

- `commitzero.config.json|js` (opcional):
  - Define reglas, idioma, hooks y comandos de pre-commit usados por la CLI.

### Ejemplo completo

```
{
  "types": [
    "feat", "fix", "docs", "style", "refactor", "perf",
    "test", "build", "ci", "chore", "revert"
  ],
  "scopes": [],
  "requireScope": false,
  "maxSubjectLength": 72,
  "allowBreaking": true,
  "footerKeywords": ["BREAKING CHANGE", "Closes", "Refs"],
  "preCommitCommands": [],
  "hookInstallPath": ".git/hooks",
  "language": "en"
}
```

### Propiedades

- `types`: Tipos de commit permitidos siguiendo Conventional Commits.
- `scopes`: Scopes permitidos. Un array vacío significa que cualquier scope en minúsculas es aceptado.
- `requireScope`: Cuando `true`, se debe proporcionar un scope.
- `maxSubjectLength`: Máximo de caracteres permitidos en el asunto del commit.
- `allowBreaking`: Cuando `false`, no permite `feat!` y exige el footer `BREAKING CHANGE` cuando hay cambios rompientes.
- `footerKeywords`: Palabras clave reconocidas como footers del commit (por ejemplo, referencias, cambios rompientes).
- `preCommitCommands`: Array de comandos de shell para ejecutar antes del commit.
- `hookInstallPath`: Dónde se instalan los hooks de Git. Por defecto: `.git/hooks`.
- `language`: Idioma de salida de la CLI y de las reglas. Valores aceptados: `en`, `pt`, `es`. Por defecto: `en`.

### Comandos que alimentan `preCommitCommands`

- Agregar un comando:
  - `commitzero pre-commit add "npm run lint"`
- Quitar un comando:
  - `commitzero pre-commit remove "npm run lint"`

Consejo: mantén `preCommitCommands` como un array vacío si no necesitas chequeos de pre-commit.

## Compatibilidad

- Node >= 16 (CLI/pruebas prefieren Node >= 18).

## Contribuyendo

- Mantén los READMEs de idiomas sincronizados:
  - Fuente: `README.md` (English)
  - Espejos: `README.pt-BR.md`, `README.es.md`
- Al actualizar la documentación, edita primero en inglés y replica el cambio:
  - Aplica la misma estructura, títulos y ejemplos.
  - Mantén correctos los enlaces de idiomas al principio.
- Prefiere cambios pequeños e iterativos para facilitar la revisión.

## Checklist para PRs de documentación

- Enlaces de idiomas presentes y correctos al principio.
- Los ejemplos de comandos se ejecutan como se describe: rutas, comillas, expansión de `$'...'`, creación de archivo, instalación del hook.
- Títulos y términos consistentes entre todos los idiomas.
- Cambios replicados en `README.pt-BR.md` y `README.es.md`.
- Ejecuta `npm run build` y `npm test` si cambiaron ejemplos de CLI o sintaxis.
- Actualiza pruebas de integración cuando cambie el comportamiento documentado.
- Las notas de versión de Node siguen siendo correctas.

### Eliminación de hooks

- Al desinstalar, CommitZero intenta eliminar automáticamente su bloque gestionado de los hooks de Git.
- Si el gestor de paquetes no ejecuta `postuninstall`, elimina las líneas entre `# CommitZero managed block START` y `# CommitZero managed block END` en:
  - `.git/hooks/commit-msg`
  - `.git/hooks/prepare-commit-msg`
- O ejecuta manualmente:

```
commitzero cleanup
```

### Idioma de los hooks

- Los hooks imprimen mensajes de guía en tu idioma cuando CommitZero no está instalado.
- Orden de detección:
  - `language` en `commitzero.config.json`
  - Variable de entorno `COMMITZERO_LANG` (`en`, `pt`, `es`)
  - Locale del SO (`LANG`), mapeando `pt_*` → `pt`, `es_*` → `es`, otros → `en`.
- Ejemplo de override por repositorio:

```
export COMMITZERO_LANG=es
```

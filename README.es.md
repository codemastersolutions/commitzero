# CommitZero

[![npm versión](https://img.shields.io/npm/v/@codemastersolutions/commitzero.svg?logo=npm&label=npm)](https://www.npmjs.com/package/@codemastersolutions/commitzero)
[![descargas npm](https://img.shields.io/npm/dm/@codemastersolutions/commitzero.svg?logo=npm)](https://www.npmjs.com/package/@codemastersolutions/commitzero)
[![licencia](https://img.shields.io/npm/l/@codemastersolutions/commitzero.svg)](https://opensource.org/licenses/MIT)
![node >=16](https://img.shields.io/badge/node-%3E%3D16-339933?logo=node.js)
[![CI](https://github.com/codemastersolutions/commitzero/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/codemastersolutions/commitzero/actions/workflows/ci.yml)
[![CodeQL](https://github.com/codemastersolutions/commitzero/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/codemastersolutions/commitzero/actions/workflows/codeql.yml)

Idiomas: [English](./README.md) | [Português 🇧🇷](./README.pt-BR.md) | Español

Validador de Conventional Commits con una CLI amigable, hooks de Git y un motor de reglas interno — sin dependencias de runtime.

## Características

- Sin dependencias de runtime; liviano y rápido.
- CLI amigable con flujo de commit interactivo.
- Instalación/eliminación de hooks de Git con ruta versionada (`.commitzero/hooks`).
- Motor de reglas interno que aplica Conventional Commits.
- Internacionalización: `en`, `pt-BR`, `es`.
- Runner y gestión de comandos de pre-commit.

## Instalación

- Proyecto local (dependencia de desarrollo):

```sh
npm i -D @codemastersolutions/commitzero
# o
pnpm add -D @codemastersolutions/commitzero
# o
yarn add -D @codemastersolutions/commitzero
```

- Ejecución puntual (sin instalar):

```sh
npx commitzero --help
```

## Guía rápida

- Inicializar configuración: `commitzero init`
- Instalar hooks versionados: `commitzero install-hooks`
- Hacer un commit interactivo: `commitzero commit`
  - Agregar automáticamente: `commitzero commit -a`
  - Hacer push después del commit: `commitzero commit -p` (desactiva el progreso con `--progress-off`)
  - Usar el buffer principal en lugar de la pantalla alternativa: `commitzero commit --no-alt-screen`
  - Definir timeout de pre-commit: `commitzero commit -t 2m` (o `--timeout 120s`)

## Uso del CLI

- Ayuda: `commitzero --help`
- Inicializar configuración: `commitzero init`
- Lint de mensaje:
  - Vía archivo: `commitzero lint --file tmp/commit.txt`
  - Vía argumento: `commitzero lint -m "feat(core): add x"`
- Validar el commit actual (hook): `commitzero check`
- Hooks: `commitzero install-hooks` / `commitzero uninstall-hooks`
  - Opciones:
    - `--force`: Sobrescribir configuración de ruta de hooks existente
    - `--init-git`: Inicializar repositorio git si aún no está inicializado
- Gestión de comandos de pre-commit:
  - Agregar: `commitzero pre-commit add "npm run lint"`
  - Quitar: `commitzero pre-commit remove "npm run lint"`
- Commit interactivo: `commitzero commit`
  - Agregar cambios automáticamente: `commitzero commit -a` o `commitzero commit --add`
  - Commit y push: `commitzero commit -p` o `commitzero commit --push`
  - Desactivar animación de progreso del push: `commitzero commit --progress-off`
  - Desactivar pantalla alternativa (usar buffer principal): `commitzero commit --no-alt-screen`

### Commit interactivo: navegación y visualización

- Navega con `↑`/`↓` o `j`/`k` (con wrap-around).
- Confirma con `Enter`. Cancela con `Ctrl+C`.
- Usa la pantalla alternativa del terminal por defecto para paginación estable.
- Opt-out vía `--no-alt-screen` o configura `uiAltScreen: false`.

## Notas especiales

### Si el comando `commitzero` devuelve no encontrado, usa un gestor de paquetes para ejecutarlo. Esto se debe a que es una dependencia de desarrollo y algunos gestores de paquetes no instalan el ejecutable globalmente.

```sh
# npm
npm run commitzero --help
# o
# pnpm
pnpm commitzero --help
# o
# yarn
yarn commitzero --help
```

### Si estás usando Windows

- Los hooks deben ser ejecutables en Git Bash.
- Los comandos de pre-commit deben ser ejecutables en Git Bash.

### Ejemplo de instalación de hooks

#### Inicializar un repositorio git

```sh
git init
```

#### Instalar hooks de commit

Los hooks se instalan automáticamente en el directorio `.commitzero/hooks` y Git se configura para usar esta ruta. Esto asegura que los hooks estén bajo control de versiones.

```sh
commitzero install-hooks
# o
npm run commitzero install-hooks
# o
pnpm commitzero install-hooks
# o
yarn commitzero install-hooks
```

**Opciones:**

- `--force`: Sobrescribir configuración de ruta de hooks existente sin confirmación
- `--init-git`: Inicializar repositorio git si aún no está inicializado

**Prompts interactivos:**

- Si Git no está inicializado, se te pedirá que lo inicialices
- Si ya hay una ruta de hooks diferente configurada, se te preguntará para confirmar la sobrescritura

#### Verificar hooks de commit

```sh
ls -l .commitzero/hooks/commit-msg
# Debe ser ejecutable e incluir el bloque gestionado por CommitZero
```

## Mensajes multi-línea

- Prefiera `--file` para mensajes con body/footers:

```sh
printf "feat(core): change\n\nBody text\n\nRefs: 123" > tmp/commit.txt
commitzero lint --file tmp/commit.txt
# o
npm run commitzero lint --file tmp/commit.txt
# o
pnpm commitzero lint --file tmp/commit.txt
# o
yarn commitzero lint --file tmp/commit.txt
```

- Alternativa con `$'...'` para expandir `\n` en el shell:

```sh
commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# o
npm run commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# o
pnpm commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
# o
yarn commitzero lint -m $'feat(core): change\n\nBody text\n\nRefs: 123'
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

### Propiedades

- `types`: Tipos de commit permitidos siguiendo Conventional Commits.
- `scopes`: Scopes permitidos. Un array vacío significa que cualquier scope en minúsculas es aceptado.
- `requireScope`: Cuando `true`, se debe proporcionar un scope.
- `maxSubjectLength`: Máximo de caracteres permitidos en el asunto del commit.
- `allowBreaking`: Cuando `false`, no permite `feat!` y exige el footer `BREAKING CHANGE` cuando hay cambios rompientes.
- `footerKeywords`: Palabras clave reconocidas como footers del commit (por ejemplo, referencias, cambios rompientes).
- `preCommitCommands`: Array de comandos de shell para ejecutar antes del commit.
- `preCommitTimeout`: Timeout para cada comando de pre-commit. Acepta número (ms) o cadena de duración (`"90s"`, `"2m"`, `"1500ms"`). Por defecto: `"3m"`.
- `language`: Idioma de salida de la CLI y de las reglas. Valores aceptados: `en`, `pt`, `es`. Por defecto: `en`.
- `uiAltScreen`: Cuando `true`, los prompts interactivos se renderizan en la pantalla alternativa del terminal para una visualización estable. Desactívalo con `--no-alt-screen` o configúralo en `false`.

### Variables de entorno

- `COMMITZERO_LANG`: Sobrescribe idioma (`en`, `pt`, `es`).
- `NO_ALT_SCREEN=1`: Desactiva pantalla alternativa para prompts interactivos.
- `COMMITZERO_PRE_COMMIT_TIMEOUT`: Timeout para comandos de pre-commit. Ej.: `"2m"`, `"120s"`, `"5000ms"`. Tiene precedencia sobre la configuración.

### Ruta de los hooks

- Respeta la configuración de Git `core.hooksPath` si está definida.
- Usa `.git/hooks` por defecto cuando `core.hooksPath` no está configurado.
- `commitzero install-hooks` configura `core.hooksPath` a `.commitzero/hooks` para que los hooks estén versionados en el repositorio.

### Comandos que alimentan `preCommitCommands`

- Agregar un comando:

```sh
commitzero pre-commit add "npm run lint"
# o
npm run commitzero pre-commit add "npm run lint"
# o
pnpm commitzero pre-commit add "npm run lint"
# o
yarn commitzero pre-commit add "npm run lint"
```

- Quitar un comando:

```sh
commitzero pre-commit remove "npm run lint"
# o
npm run commitzero pre-commit remove "npm run lint"
# o
pnpm commitzero pre-commit remove "npm run lint"
# o
yarn commitzero pre-commit remove "npm run lint"
```

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
  - `.commitzero/hooks/commit-msg` or `.git/hooks/commit-msg`
  - `.commitzero/hooks/prepare-commit-msg` or `.git/hooks/prepare-commit-msg`
- O ejecuta manualmente:

```sh
commitzero cleanup
# o
npm run commitzero cleanup
# o
pnpm commitzero cleanup
# o
yarn commitzero cleanup
```

Nota: `uninstall-hooks` y `cleanup` no eliminan los scripts del `package.json`. Los scripts `commitzero`, `commitzero:install` y `commitzero:uninstall` se conservan por conveniencia.

### Idioma de los hooks

- Los hooks imprimen mensajes de guía en tu idioma cuando CommitZero no está instalado.
- Orden de detección:
  - `language` en `commitzero.config.json`
  - Variable de entorno `COMMITZERO_LANG` (`en`, `pt`, `es`)
  - Locale del SO (`LANG`), mapeando `pt_BR*` → `pt`, `es_*` → `es`, otros → `en`.
- Ejemplo de override por repositorio:

```sh
export COMMITZERO_LANG=es
```

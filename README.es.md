# CommitZero

Idiomas: [English](./README.md) | [Português Brasil](./README.pt-BR.md) | Español

Validador de Conventional Commits con una CLI amigable, hooks de Git y un motor de reglas interno — sin dependencias de runtime.

## Instalación

- Proyecto local (dependencia de desarrollo):
  - `npm i -D @codemastersolutins/commitzero`
  - `pnpm add -D @codemastersolutins/commitzero`
  - `yarn add -D @codemastersolutins/commitzero`

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
  - `types`, `scopes`, `maxSubjectLength`, `requireScope`, `allowBreaking`, `footerKeywords`, `hookInstallPath`, `language`.

- `language` define el idioma de salida de la CLI y de las reglas. Valores aceptados: `en`, `pt`, `es`. Por defecto: `en`.
- Ejemplo:

```
{
  "language": "es"
}
```

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
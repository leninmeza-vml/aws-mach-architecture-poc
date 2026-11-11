---
title: Convenciones del LLM Wiki
updated: 2026-11-11
tags: [conventions, schema, governance]
---

# Convenciones y Esquema Operativo del LLM Wiki (`conventions.md`)

Este documento complementa a [../AGENTS.md](../AGENTS.md) detallando la estructura interna del directorio `wiki/`.

## 1. Estructura de Directorios

```text
wiki/
├── index.md          # Catálogo orientado a contenido (punto de entrada de lectura)
├── log.md            # Registro cronológico append-only con prefijo ## [YYYY-MM-DD] op | título
├── overview.md       # Síntesis global del proyecto y estado actual
├── conventions.md    # Este archivo de reglas y convenciones de formato
├── raw/              # Fuentes crudas inmutables (solo lectura para el LLM)
├── sources/          # Resúmenes de documentos fuente ingeridos
├── concepts/         # Patrones arquitectónicos, estándares y principios teóricos
├── entities/         # Componentes concretos del sistema (apps, paquetes, stacks CDK)
└── analyses/         # Comparativas, síntesis profundas y decisiones arquitectónicas (ADRs)
```

## 2. Formato de Páginas

Cada página dentro de `wiki/` debe incluir un bloque de metadatos YAML (frontmatter) compatible con Obsidian y Dataview:

```yaml
---
title: Título Descriptivo
updated: YYYY-MM-DD
tags: [tag1, tag2]
sources: [prompt-setup-poc-aws-vscode.md]
---
```

## 3. Reglas de Escritura y Mantenimiento para el Agente
1. **Extender en lugar de duplicar**: Antes de crear una nueva página en `concepts/` o `entities/`, verifica `index.md`. Si el tema ya existe, amplía y actualiza la página existente.
2. **Reescribir la síntesis, no solo concatenar**: Las páginas de `concepts/` y `entities/` deben reflejar el estado vigente y coherente del sistema; el historial cronológico pertenece a `log.md`.
3. **Referencias verificables**: Toda afirmación sobre la implementación debe enlazar al archivo real del repositorio (p. ej., `apps/xapi/src/handler.ts` o `infra/lib/poc-stack.ts`).
4. **Idioma**: Todo el contenido del wiki se redacta en **español** técnico claro y conciso.

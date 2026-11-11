---
title: Registro Cronológico de Operaciones (Log)
updated: 2026-11-11
---

# Bitácora del LLM Wiki (`log.md`)

Registro cronológico (`append-only`) de ingestas, consultas, actualizaciones arquitectónicas y pases de verificación.
Para consultar las últimas 5 operaciones vía terminal: `grep "^## \[" wiki/log.md | tail -5`.

---

## [2026-11-11] init | Inicialización de la estructura LLM Wiki (Karpathy Pattern)
- Se creó la arquitectura de tres capas (`wiki/raw/`, `wiki/` compilado y esquema en `AGENTS.md` + `wiki/conventions.md`).
- Se inicializaron los catálogos `index.md`, `overview.md`, `conventions.md` y los directorios `sources/`, `concepts/`, `entities/` y `analyses/`.

## [2026-11-11] ingest | Prompt Maestro: Generación Autónoma de PoC MACH en AWS (`prompt-setup-poc-aws-vscode.md`)
- Fuente original copiada/referenciada en `wiki/raw/` y sintetizada en `wiki/sources/prompt-setup-poc-aws-vscode.md`.
- Páginas de conceptos creadas: `mach-architecture.md`, `api-led-connectivity.md`, `w3c-trace-context.md`, `zero-static-credentials-oidc.md`.
- Páginas de entidades creadas: `apps-web.md`, `apps-xapi.md`, `apps-papi.md`, `apps-sapi.md`, `infra-cdk.md`.
- Análisis creado: `mach-api-led-synergy.md`.

## [2026-11-11] update | Ejecución integral del Monorepo PoC MACH en AWS e indexación en Codebase Memory
- Se verificó e instaló el toolchain local (`Node.js v22`, `pnpm v12`, `AWS CLI v2`, `AWS CDK v2`, `uv`).
- Se generaron todos los paquetes compartidos (`@poc-mach/types`, `@poc-mach/database`, `@poc-mach/tsconfig`, `@poc-mach/eslint-config`), las aplicaciones (`web`, `xapi`, `papi`, `sapi`), la infraestructura (`@poc-mach/infra`), los flujos CI/CD (`.github/workflows/`) y la documentación técnica (`docs/`).
- Se indexó el repositorio completo en `codebase-memory`.

## [2026-11-11] update | Regla obligatoria de Codebase Memory, verificación con gh CLI y primer despliegue de Frontend en GitHub Pages
- Se añadió la sección `1.B REGLA INQUEBRANTABLE DE USO OBLIGATORIO DE CODEBASE MEMORY` en `AGENTS.md`.
- Se creó la página `wiki/concepts/codebase-memory-and-gh-cli.md` y se actualizó `wiki/index.md`.
- Se re-indexó el proyecto en `codebase-memory` y se ejecutó el despliegue de `apps/web` hacia GitHub Pages verificando los workflows con `gh run`.


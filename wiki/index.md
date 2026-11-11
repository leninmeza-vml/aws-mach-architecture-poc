---
title: Índice Maestro del LLM Wiki
updated: 2026-11-11
---

# Índice Maestro del LLM Wiki (`index.md`)

> **Instrucción para Agentes**: Este archivo es el punto de entrada obligatorio para cualquier consulta (`query`), ingesta (`ingest`) o auditoría (`lint`). Léelo antes de explorar el repositorio y mantenlo actualizado tras cualquier modificación.

---

## 1. Núcleo y Gobernanza

- [overview.md](overview.md) — Síntesis ejecutiva del proyecto PoC MACH + API-Led en AWS, estado actual y topología.
- [conventions.md](conventions.md) — Reglas de formato, frontmatter YAML, enlaces cruzados y protocolo de mantenimiento del LLM Wiki.
- [log.md](log.md) — Bitácora cronológica (`append-only`) de todas las operaciones realizadas sobre el wiki y el repositorio.

---

## 2. Fuentes Ingeridas (`sources/`)

- [sources/prompt-setup-poc-aws-vscode.md](sources/prompt-setup-poc-aws-vscode.md) — Resumen estructurado y desglose en 7 fases del Prompt Maestro de generación de la PoC MACH en AWS (`prompt-setup-poc-aws-vscode.md`).

---

## 3. Conceptos y Patrones (`concepts/`)

- [concepts/mach-architecture.md](concepts/mach-architecture.md) — Principios **M**icroservices, **A**PI-first, **C**loud-native y **H**eadless aplicados al stack AWS Serverless y Next.js.
- [concepts/api-led-connectivity.md](concepts/api-led-connectivity.md) — Separación estricta en tres capas: Experience API (`xAPI`), Process API (`pAPI`) y System API (`sAPI`).
- [concepts/w3c-trace-context.md](concepts/w3c-trace-context.md) — Propagación extremo a extremo del estándar W3C `traceparent` desde el navegador hasta PostgreSQL.
- [concepts/zero-static-credentials-oidc.md](concepts/zero-static-credentials-oidc.md) — Seguridad DevSecOps sin claves estáticas mediante AWS IAM Identity Center (SSO) y federación OIDC en GitHub Actions.
- [concepts/codebase-memory-and-gh-cli.md](concepts/codebase-memory-and-gh-cli.md) — Regla obligatoria Graph-First con `codebase-memory` y comandos de `gh` CLI para auditar y verificar GitHub Actions y despliegues en GitHub Pages.

---

## 4. Entidades del Sistema (`entities/`)

- [entities/apps-web.md](entities/apps-web.md) — Frontend Headless en Next.js (`apps/web`), exportación estática para GitHub Pages, CSP y formularios reactivos.
- [entities/apps-xapi.md](entities/apps-xapi.md) — Experience API (`apps/xapi`), Lambda tras API Gateway v2 HTTP API, validación JWT y adaptación de contratos.
- [entities/apps-papi.md](entities/apps-papi.md) — Process API (`apps/papi`), Lambda de orquestación, evaluación de reglas de negocio y límites transaccionales.
- [entities/apps-sapi.md](entities/apps-sapi.md) — System API (`apps/sapi`), Lambda aislada en subred privada VPC con acceso parametrizado a PostgreSQL/YugabyteDB.
- [entities/infra-cdk.md](entities/infra-cdk.md) — Stack de AWS CDK v2 (`infra/`), VPC, Security Groups de privilegio mínimo, RDS PostgreSQL, Secrets Manager y API Gateway v2.

---

## 5. Análisis y Decisiones Arquitectónicas (`analyses/`)

- [analyses/mach-api-led-synergy.md](analyses/mach-api-led-synergy.md) — Análisis de cómo la combinación de MACH y API-Led Connectivity evita el acoplamiento monolítico en arquitecturas Serverless.

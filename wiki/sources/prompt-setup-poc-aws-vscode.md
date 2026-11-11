---
title: "Fuente: Prompt Maestro de PoC MACH en AWS"
updated: 2026-11-11
tags: [source, prompt, mach, aws, monorepo]
source_path: ../../prompt-setup-poc-aws-vscode.md
---

# Fuente: `prompt-setup-poc-aws-vscode.md`

## Resumen Ejecutivo
Documento de especificación maestra que instruye la construcción automatizada de una Prueba de Concepto (PoC) basada en arquitectura **MACH** y **API-Led Connectivity** sobre AWS, gestionada como un monorepo con `pnpm` y `Turborepo`.

## Desglose de las 7 Fases Especificadas

1. **Fase 1 — Toolchain Local y Autenticación SSO**:
   - Herramientas: Node.js v20+ LTS, `pnpm`, AWS CLI v2, AWS CDK v2, `uv`.
   - Configuración VS Code: `.vscode/extensions.json` y `.vscode/mcp.json` con servidores MCP de AWS Labs (`awslabs-documentation`, `awslabs-iam`, `awslabs-cloudwatch`).
   - Autenticación: Uso exclusivo de AWS SSO (`aws configure sso --profile poc-mach-dev`).
2. **Fase 2 — Topología Monorepo (`pnpm` + `Turborepo`)**:
   - Espacios de trabajo en `apps/*`, `packages/*` e `infra`.
   - Contratos compartidos en `packages/types` (`CreateTransactionSchema`, `TransactionResponseSchema`, `QueryStatusSchema`).
3. **Fase 3 — Frontend Headless (`apps/web`)**:
   - Next.js App Router con `output: 'export'` para GitHub Pages.
   - Dos formularios reactivos (creación de transacción POST y consulta de estado GET).
   - Cabeceras W3C `traceparent` y Content-Security-Policy (CSP).
4. **Fase 4 — Microservicios API-Led (`xAPI`, `pAPI`, `sAPI`)**:
   - Separación estricta de responsabilidades entre experiencia, proceso y sistema.
5. **Fase 5 — Infraestructura como Código (`infra/`)**:
   - AWS CDK v2 en TypeScript (`infra/lib/poc-stack.ts`) definiendo VPC, RDS PostgreSQL en subred privada, Secrets Manager, API Gateway v2 con JWT Authorizer y CloudWatch Logs.
6. **Fase 6 — DevSecOps y CI/CD (`.github/workflows/`)**:
   - Federación OIDC sin credenciales estáticas, workflows para CI, GitHub Pages y CDK, más Dependabot.
7. **Fase 7 — Documentación Centralizada (`docs/`)**:
   - `docs/ARCHITECTURE.md` (C4), `docs/OPENAPI.yaml` y `docs/DEPLOYMENT_GUIDE.md`.

## Páginas Relacionadas
- [../concepts/mach-architecture.md](../concepts/mach-architecture.md)
- [../concepts/api-led-connectivity.md](../concepts/api-led-connectivity.md)
- [../entities/infra-cdk.md](../entities/infra-cdk.md)

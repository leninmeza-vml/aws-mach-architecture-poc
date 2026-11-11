---
title: "Entidad: System API (apps/sapi)"
updated: 2026-11-11
tags: [entity, sapi, lambda, vpc, postgresql, yugabytedb]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Entidad: `apps/sapi` (System API)

## Ubicación y Rol
- **Ruta**: `apps/sapi/`
- **Entrypoint**: `apps/sapi/src/handler.ts`
- **Capa API-Led**: System API ([../concepts/api-led-connectivity.md](../concepts/api-led-connectivity.md)).

## Responsabilidades
1. **Aislamiento en Red Privada**:
   - Desplegada en subredes privadas aisladas dentro de la VPC definida en [infra-cdk.md](infra-cdk.md).
   - Su Security Group es el único autorizado a abrir conexiones TCP hacia el puerto `5432` del Security Group de la base de datos.
2. **Persistencia Tipada, Inicialización Automática en RDS y Logs CloudWatch**:
   - Emite logs JSON estructurados con `traceparent` y `transactionId` hacia `/aws/lambda/wppes-mach-poc-dev-mxc1-lmb-sapi`.
   - Utiliza `@poc-mach/database` (`packages/database`) para conectar con **Amazon RDS PostgreSQL 16** (`wppes-mach-poc-dev-mxc1-rds-pg` en `mx-central-1`), ejecutando `CREATE TABLE IF NOT EXISTS transactions (...)` de forma idempotente e inserciones/lecturas parametrizadas validadas con `TransactionResponseSchema`.
   - Empaqueta `pg`, `zod` y `@poc-mach/database` con `esbuild` en `apps/sapi/dist-lambda/handler.js` y mantiene cobertura unitaria del `100%`.

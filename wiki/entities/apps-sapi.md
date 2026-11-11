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
2. **Persistencia Tipada y Parametrizada**:
   - Utiliza `@poc-mach/database` (`packages/database`) para ejecutar inserciones y lecturas parametrizadas sobre PostgreSQL / YugabyteDB, previniendo inyección SQL y devolviendo registros validados con `TransactionResponseSchema`.

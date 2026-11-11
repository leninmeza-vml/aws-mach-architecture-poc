---
title: "Entidad: Experience API (apps/xapi)"
updated: 2026-11-11
tags: [entity, xapi, lambda, api-gateway, jwt]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Entidad: `apps/xapi` (Experience API)

## Ubicación y Rol
- **Ruta**: `apps/xapi/`
- **Entrypoint**: `apps/xapi/src/handler.ts`
- **Capa API-Led**: Experience API ([../concepts/api-led-connectivity.md](../concepts/api-led-connectivity.md)).

## Responsabilidades
1. **Exposición HTTP**: Recibe eventos desde Amazon API Gateway v2 (`POST /v1/transactions` y `GET /v1/transactions/{id}`).
2. **Seguridad JWT**: Verifica la presencia y estructura del token Bearer en `Authorization: Bearer <token>` (complementando el JWT Authorizer de Cognito en API Gateway).
3. **Validación y Adaptación**: Valida el payload entrante con `CreateTransactionSchema` o `QueryStatusSchema` (`@poc-mach/types`).
4. **Propagación W3C y Delegación**: Extrae o inicializa el header `traceparent`, genera un *child span* y delega la ejecución a [apps-papi.md](apps-papi.md).

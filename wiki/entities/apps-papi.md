---
title: "Entidad: Process API (apps/papi)"
updated: 2026-11-11
tags: [entity, papi, lambda, orchestration, business-rules]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Entidad: `apps/papi` (Process API)

## Ubicación y Rol
- **Ruta**: `apps/papi/`
- **Entrypoint**: `apps/papi/src/handler.ts`
- **Capa API-Led**: Process API ([../concepts/api-led-connectivity.md](../concepts/api-led-connectivity.md)).

## Responsabilidades
1. **Reglas de Negocio y Orquestación**:
   - Evalúa límites de monto, calcula nivel de riesgo (`LOW`, `MEDIUM`, `HIGH`) y determina el estado inicial de la transacción (`PENDING`, `APPROVED`, `REJECTED`).
2. **Aislamiento de Persistencia**:
   - No tiene acceso directo a PostgreSQL ni atiende tráfico directo de clientes web.
3. **Coordinación con System API y Observabilidad CloudWatch**:
   - Emite logs JSON estructurados con `traceparent`, `riskLevel` y `status` hacia `/aws/lambda/wppes-mach-poc-dev-mxc1-lmb-papi`.
   - En AWS invoca la función Lambda remota `SAPI_FUNCTION_NAME` (`wppes-mach-poc-dev-mxc1-lmb-sapi`) vía `@aws-sdk/client-lambda` (`invokeRemoteSapiLambda`), y en entorno local delega en memoria a [apps-sapi.md](apps-sapi.md).
   - Empaqueta sus dependencias con `esbuild` en `apps/papi/dist-lambda/handler.js` y mantiene cobertura unitaria `> 98%`.

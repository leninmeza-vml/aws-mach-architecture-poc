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
3. **Coordinación con System API**:
   - Invoca a [apps-sapi.md](apps-sapi.md) propagando el contexto de traza W3C (`traceparent`).

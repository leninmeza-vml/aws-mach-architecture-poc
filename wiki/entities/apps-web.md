---
title: "Entidad: Frontend Headless (apps/web)"
updated: 2026-11-11
tags: [entity, frontend, nextjs, headless, github-pages]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Entidad: `apps/web` (Frontend Headless)

## Ubicación y Stack
- **Ruta**: `apps/web/`
- **Framework**: Next.js 14 (App Router) con React 18 y TypeScript.
- **Modo de compilación**: `output: 'export'` en `apps/web/next.config.js` para generación de HTML estático desplegable en **GitHub Pages**.

## Características Clave
1. **Formularios Reactivos con Validación Zod**:
   - **Formulario 1 (Crear Transacción)**: Valida con `CreateTransactionSchema` de `@poc-mach/types` y envía `POST /v1/transactions` a la `xAPI`.
   - **Formulario 2 (Consultar Estado)**: Valida con `QueryStatusSchema` y envía `GET /v1/transactions/{transactionId}` a la `xAPI`.
2. **Trazabilidad W3C**:
   - Genera y adjunta `traceparent: 00-{traceId}-{spanId}-01` en cada petición mediante `createTraceparent()` de `@poc-mach/types`.
3. **Seguridad del Navegador (CSP)**:
   - `apps/web/src/app/layout.tsx` incluye la directiva `Content-Security-Policy` restringiendo `connect-src` a los dominios de Amazon API Gateway (`*.execute-api.us-east-1.amazonaws.com`) y Amazon Cognito (`*.amazoncognito.com`).

## Relaciones
- Consume contratos de `@poc-mach/types`.
- Invoca por HTTP a [apps-xapi.md](apps-xapi.md).

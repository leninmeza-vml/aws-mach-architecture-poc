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
1. **Identidad Corporativa WPP Enterprise Solutions**:
   - Referencia explícita y enlace directo a `https://www.wpp.com/en/wpp-enterprise-solutions` en cabecera y pie de página.
2. **Separación por Pestañas (`Tabs`) con Estado Persistente Independiente**:
   - **Pestaña 1 (`POST /v1/transactions`)**: Mantiene su propio estado (`postState`: respuesta `201`, traza `traceparent`, animación por capas e historial `createdHistory`).
   - **Pestaña 2 (`GET /v1/transactions/{id}`)**: Mantiene su propio estado independiente (`getState`: respuesta `200`, traza `traceparent`, animación por capas e historial `queriedHistory`) y permite seleccionar con un clic cualquier UUID creado en la Pestaña 1 sin borrar ninguna de las dos respuestas.
   - **Pestaña 3 (`Nomenclatura Estándar WPP & Setup AWS SSO`)**: Catálogo interactivo de recursos `wppes-mach-poc-dev-use1-*` y guía de comandos CLI.
3. **Diagrama Interactivo en Tiempo Real por Capas (6 Saltos)**:
   - Muestra el recorrido en vivo `Headless SPA -> API Gateway + Cognito -> xAPI -> pAPI -> sAPI (VPC) -> RDS PostgreSQL (5432)`.
   - Permite hacer clic en cualquier nodo del diagrama para inspeccionar el `spanId` W3C, headers, evaluación de reglas de negocio y la sentencia SQL parametrizada ejecutada.
4. **Seguridad del Navegador (CSP)**:
   - `apps/web/src/app/layout.tsx` incluye la directiva `Content-Security-Policy` restringiendo `connect-src` a los dominios de Amazon API Gateway (`*.execute-api.us-east-1.amazonaws.com`) y Amazon Cognito (`*.amazoncognito.com`).

## Relaciones
- Consume contratos de `@poc-mach/types`.
- Invoca por HTTP a [apps-xapi.md](apps-xapi.md).

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
2. **Acordeón Interactivo de 4 Paneles (Inicia Cerrado)**:
   - **Panel 1 (`poc-overview`)**: Breve explicación ejecutiva de los 4 pilares MACH y su aplicación en Querétaro (`mx-central-1`).
   - **Panel 2 (`aws-services`)**: Tabla resumen de los servicios AWS y GitHub utilizados bajo la nomenclatura `wppes-mach-poc-dev-mxc1-*`.
   - **Panel 3 (`mermaid-api-led`)**: Diagrama Mermaid renderizado dinámicamente (`MermaidDiagramView`) que ilustra la arquitectura en modo **API-Led Connectivity** (`xAPI -> pAPI -> sAPI -> RDS`).
   - **Panel 4 (`mermaid-e2e-cicd`)**: Diagrama Mermaid de secuencia de extremo a extremo desde **GitHub Actions (OIDC + Pages)** hasta **Amazon RDS PostgreSQL 16** en `mx-central-1`.
3. **Separación por Pestañas (`Tabs`) con Estado Persistente Independiente**:
   - **Pestaña 1 (`POST /v1/transactions`)**: Mantiene su propio estado (`postState`: respuesta `201`, traza `traceparent`, animación por capas e historial `createdHistory`).
   - **Pestaña 2 (`GET /v1/transactions/{id}`)**: Mantiene su propio estado independiente (`getState`: respuesta `200`, traza `traceparent`, animación por capas e historial `queriedHistory`) y permite seleccionar con un clic cualquier UUID creado en la Pestaña 1 sin borrar ninguna de las dos respuestas.
   - **Pestaña 3 (`Nomenclatura Estándar WPP & Setup AWS SSO`)**: Catálogo interactivo de recursos `wppes-mach-poc-dev-mxc1-*` y guía de comandos CLI.
4. **Diagrama Interactivo en Tiempo Real por Capas (6 Saltos)**:
   - Muestra el recorrido en vivo `Headless SPA -> API Gateway + Cognito -> xAPI -> pAPI -> sAPI (VPC) -> RDS PostgreSQL (5432)`.
   - Permite hacer clic en cualquier nodo del diagrama para inspeccionar el `spanId` W3C, headers, evaluación de reglas de negocio y la sentencia SQL parametrizada ejecutada.
5. **Seguridad del Navegador (CSP)**:
   - `apps/web/src/app/layout.tsx` incluye la directiva `Content-Security-Policy` restringiendo `connect-src` a los dominios de Amazon API Gateway (`*.execute-api.mx-central-1.amazonaws.com`) y Amazon Cognito (`*.amazoncognito.com`).

## Relaciones
- Consume contratos de `@poc-mach/types`.
- Invoca por HTTP a [apps-xapi.md](apps-xapi.md).

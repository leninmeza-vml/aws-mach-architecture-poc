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
1. **Identidad y Contexto de Negocio de WPP Enterprise Solutions & VML**:
   - El encabezado explica el objetivo empresarial de la PoC (demostrar las capacidades de **WPP Enterprise Solutions** y **VML** con más de 12,000 expertos en más de 40 mercados implementando arquitecturas componibles **MACH** y **API-Led Connectivity** sobre AWS en Querétaro, México).
2. **Acordeón Interactivo de 4 Paneles con Estilo Visual Unificado (`#38bdf8`)**:
   - **Panel 1 (`poc-overview`)**: Capacidades de WPP Enterprise Solutions & VML y explicación de los 4 pilares MACH.
   - **Panel 2 (`aws-services`)**: Consolida en un único lugar la tabla de servicios de AWS y GitHub, la convención de nomenclatura `wppes-mach-poc-dev-mxc1-*` y los comandos de despliegue sin claves estáticas (eliminando la antigua tercera pestaña duplicada).
   - **Panel 3 (`mermaid-api-led`)**: Diagrama Mermaid en vivo de la arquitectura API-Led Connectivity (`xAPI -> pAPI -> sAPI -> RDS`).
   - **Panel 4 (`mermaid-e2e-cicd`)**: Diagrama Mermaid de secuencia de extremo a extremo desde GitHub Actions (OIDC + Pages) hasta Amazon RDS PostgreSQL 16 en `mx-central-1`.
3. **Dos Pestañas Operativas Persistentes (`POST` y `GET`)**:
   - **Pestaña 1 (`POST /v1/transactions`)** y **Pestaña 2 (`GET /v1/transactions/{id}`)** mantienen sus respuestas, historiales y diagramas interactivos de 6 capas de manera independiente.
4. **Glosario de Términos Técnicos y Arquitectónicos (`#glosario-tecnico`) y Footer Enriquecido**:
   - Define en lenguaje claro qué es **Zod**, **W3C Trace Context (`traceparent`)**, la **Nomenclatura `wppes-mach-poc-dev-mxc1-*`**, **MACH**, **API-Led Connectivity**, **OIDC** y **AWS CDK v2**, con enlaces directos desde la cabecera y el pie de página.
5. **Seguridad del Navegador (CSP)**:
   - `apps/web/src/app/layout.tsx` incluye la directiva `Content-Security-Policy` restringiendo `connect-src` a los dominios de Amazon API Gateway (`*.execute-api.mx-central-1.amazonaws.com`) y Amazon Cognito (`*.amazoncognito.com`).

## Relaciones
- Consume contratos de `@poc-mach/types`.
- Invoca por HTTP a [apps-xapi.md](apps-xapi.md).

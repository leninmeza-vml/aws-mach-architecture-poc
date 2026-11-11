---
title: Descripción General del Sistema (Overview)
updated: 2026-11-11
tags: [overview, mach, api-led, aws, monorepo]
---

# Síntesis Ejecutiva: PoC MACH & API-Led Connectivity en AWS

## Propósito
Esta Prueba de Concepto (PoC) demuestra la implementación práctica de una arquitectura **MACH** ([concepts/mach-architecture.md](concepts/mach-architecture.md)) combinada con el patrón **API-Led Connectivity** ([concepts/api-led-connectivity.md](concepts/api-led-connectivity.md)) desplegada de forma nativa en **AWS** y gestionada dentro de un monorepo con `pnpm` y `Turborepo`.

## Síntesis Arquitectónica
1. **Capa de Presentación Headless ([entities/apps-web.md](entities/apps-web.md))**:
   - Aplicación **Next.js** configurada con `output: 'export'` para alojarse de forma 100% estática en **GitHub Pages**.
   - Emite peticiones HTTPS con cabeceras de seguridad CSP y trazabilidad distribuida W3C (`traceparent`, ver [concepts/w3c-trace-context.md](concepts/w3c-trace-context.md)).
2. **Capa de Experiencia (`xAPI` - [entities/apps-xapi.md](entities/apps-xapi.md))**:
   - Expuesta a través de **Amazon API Gateway v2 (HTTP API)** con CORS estricto y autorización JWT mediante **Amazon Cognito**.
   - Valida contratos de entrada con `@poc-mach/types` (Zod) y delega el procesamiento a la `pAPI`.
3. **Capa de Procesos (`pAPI` - [entities/apps-papi.md](entities/apps-papi.md))**:
   - Orquesta la lógica transaccional, evalúa reglas de negocio (p. ej., clasificación de riesgo por monto y divisa) sin acoplarse al motor de base de datos.
   - Invoca a la `sAPI` para persistir o consultar el estado.
4. **Capa de Sistema (`sAPI` - [entities/apps-sapi.md](entities/apps-sapi.md))**:
   - Ejecutada dentro de subredes privadas aisladas de una **VPC** ([entities/infra-cdk.md](entities/infra-cdk.md)).
   - Accede a **Amazon RDS PostgreSQL / YugabyteDB** en el puerto `5432` utilizando credenciales rotadas en **AWS Secrets Manager** y consultas parametrizadas vía `@poc-mach/database`.

## Estado de Gobernanza y DevSecOps
- **Autenticación sin credenciales estáticas**: SSO local (`poc-mach-dev`) y federación OIDC en GitHub Actions ([concepts/zero-static-credentials-oidc.md](concepts/zero-static-credentials-oidc.md)).
- **Contratos sincronizados**: Validación compartida entre frontend y backend con Zod (`packages/types`) y especificación OpenAPI 3.1 (`docs/OPENAPI.yaml`).

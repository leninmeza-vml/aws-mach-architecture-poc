---
title: API-Led Connectivity (xAPI, pAPI, sAPI)
updated: 2026-11-11
tags: [concept, api-led, xapi, papi, sapi]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Concepto: API-Led Connectivity

El paradigma **API-Led Connectivity** estructura las integraciones y microservicios en tres capas bien delimitadas para maximizar la reutilización, seguridad y desacoplamiento:

## 1. Experience API (`xAPI`)
- **Propósito**: Adaptar los datos al canal consumidor específico (en este caso, la SPA en Next.js alojada en GitHub Pages).
- **Responsabilidades**: Validación de autenticación JWT, validación estructural inicial, inyección/propagación de `traceparent` y formateo de respuesta para la UI.
- **Entidad**: [../entities/apps-xapi.md](../entities/apps-xapi.md).

## 2. Process API (`pAPI`)
- **Propósito**: Encapsular la lógica de negocio, reglas de validación de dominio, cálculo de riesgo e integración entre múltiples sistemas sin depender del canal de entrada ni del motor de persistencia subyacente.
- **Responsabilidades**: Evaluar reglas sobre transacciones, enriquecer metadatos de negocio y coordinar llamadas hacia la `sAPI`.
- **Entidad**: [../entities/apps-papi.md](../entities/apps-papi.md).

## 3. System API (`sAPI`)
- **Propósito**: Abstraer la complejidad y proteger el acceso directo a los sistemas de registro (*Systems of Record*), como PostgreSQL o YugabyteDB.
- **Responsabilidades**: Gestión de conexiones seguras dentro de la VPC privada, lectura de credenciales desde Secrets Manager y ejecución de consultas SQL parametrizadas mediante `@poc-mach/database`.
- **Entidad**: [../entities/apps-sapi.md](../entities/apps-sapi.md).

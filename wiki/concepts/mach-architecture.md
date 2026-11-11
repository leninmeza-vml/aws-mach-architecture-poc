---
title: Arquitectura MACH
updated: 2026-11-11
tags: [concept, mach, microservices, api-first, cloud-native, headless]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Concepto: Arquitectura MACH

**MACH** es el acrónimo de cuatro pilares modernos de diseño de software empresarial adoptados en esta PoC:

## 1. Microservices (Microservicios)
- Cada unidad funcional (`xapi`, `papi`, `sapi`) es una función AWS Lambda independiente con responsabilidad única, desplegable y escalable de manera autónoma.
- Implementados en [../entities/apps-xapi.md](../entities/apps-xapi.md), [../entities/apps-papi.md](../entities/apps-papi.md) y [../entities/apps-sapi.md](../entities/apps-sapi.md).

## 2. API-First ( Orientado a APIs primero)
- Toda comunicación entre el frontend y las capas de backend está gobernada por contratos explícitos definidos en `docs/OPENAPI.yaml` y esquemas **Zod** en `packages/types`.
- Ningún microservicio acepta datos sin validar contra `CreateTransactionSchema` o `QueryStatusSchema`.

## 3. Cloud-Native (Nativo de la Nube)
- Uso de servicios gestionados y serverless de AWS: Amazon API Gateway v2, AWS Lambda, Amazon Cognito, AWS Secrets Manager, Amazon CloudWatch y Amazon RDS PostgreSQL aprovisionados declarativamente con AWS CDK v2 ([../entities/infra-cdk.md](../entities/infra-cdk.md)).

## 4. Headless (Sin Cabeza / Desacoplado)
- La capa de presentación ([../entities/apps-web.md](../entities/apps-web.md)) está completamente desacoplada del backend. Se genera como HTML/JS estático en GitHub Pages y se comunica únicamente mediante HTTP/JSON con la `xAPI`.

---
title: Trazabilidad Distribuida W3C Trace Context
updated: 2026-11-11
tags: [concept, observability, w3c, traceparent]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Concepto: W3C Trace Context (`traceparent`)

Para correlacionar eventos desde un frontend estático alojado en GitHub Pages hasta funciones Lambda aisladas en una VPC de AWS, el proyecto implementa el estándar **W3C Trace Context**.

## Formato del Header `traceparent`

```text
traceparent: 00-{traceId}-{spanId}-01
```

- `version` (`00`): Versión actual de la especificación W3C.
- `traceId` (32 caracteres hexadecimales en minúscula): Identificador único global de la transacción de extremo a extremo.
- `spanId` (16 caracteres hexadecimales en minúscula): Identificador del segmento o salto actual.
- `traceFlags` (`01`): Indica muestreo activo (*sampled*).

## Implementación en el Monorepo
- Las utilidades de generación, validación por expresión regular y creación de *child spans* residen en `packages/types/src/index.ts`.
- El cliente web (`apps/web`) genera el `traceparent` inicial en cada solicitud HTTP.
- `apps/xapi`, `apps/papi` y `apps/sapi` preservan el `traceId` original, generan un nuevo `spanId` al delegar a la siguiente capa y registran el `traceId` en los logs estructurados de Amazon CloudWatch.

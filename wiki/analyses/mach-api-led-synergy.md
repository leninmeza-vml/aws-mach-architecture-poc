---
title: "Análisis: Sinergia entre MACH y API-Led Connectivity en Serverless"
updated: 2026-11-11
tags: [analysis, mach, api-led, architecture, serverless]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Análisis: Sinergia entre MACH y API-Led Connectivity en Serverless

## Problema Común en Arquitecturas Serverless
En muchos proyectos Serverless, una única función Lambda conectada a API Gateway termina validando JWT, aplicando reglas de negocio y ejecutando consultas SQL directamente sobre la base de datos. Esto genera:
1. **Sobreprivilegio de red y de IAM**: La función expuesta al borde público necesita estar en la VPC y tener acceso a credenciales de base de datos.
2. **Acoplamiento de canal**: Si se agrega una aplicación móvil o un webhook B2B, se duplica la lógica de negocio.

## Solución Implementada en esta PoC
Al combinar **MACH** con **API-Led Connectivity**:
- **Seguridad en Profundidad**: Ni `xAPI` ni `pAPI` residen en la subred de base de datos ni conocen el secreto de RDS. Solo `sAPI` tiene permisos de lectura en Secrets Manager y conectividad al puerto `5432`.
- **Evolución Independiente de Canales (Headless)**: `apps/web` en GitHub Pages consume `xAPI`. Si mañana se incorpora un canal móvil, se crea una nueva `xAPI` o ruta específica que reutiliza intacta la `pAPI`.
- **Sustitución Transparente de Motor de Datos**: La transición entre Amazon RDS PostgreSQL y un clúster distribuido YugabyteDB queda encapsulada exclusivamente en `@poc-mach/database` y `apps/sapi`, sin impacto alguno en `apps/papi`, `apps/xapi` ni `apps/web`.

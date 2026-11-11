---
title: "Entidad: Infraestructura AWS CDK v2 (infra/)"
updated: 2026-11-11
tags: [entity, cdk, iac, aws, vpc, rds, apigateway]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Entidad: `infra/` (AWS CDK v2 Stack)

## Ubicación y Nomenclatura Estándar WPP Enterprise Solutions
- **Ruta**: `infra/`
- **Región Primaria**: `mx-central-1` (México Centro — Querétaro, abreviatura `mxc1`)
- **Stack Principal**: `infra/lib/poc-stack.ts` (`PocMachStack` / `WppesMachPocDevStack` -> `wppes-mach-poc-dev-mxc1-stack`)
- **App Entrypoint**: `infra/bin/infra.ts`
- **Patrón de Nomenclatura**: `wppes-{workload}-{env}-{region_short}-{resource_type}-{component}` (`wppes-mach-poc-dev-mxc1-*`)
- **Etiquetas (Tags)**: `Organization="WPP Enterprise Solutions"`, `OrganizationUrl="https://www.wpp.com/en/wpp-enterprise-solutions"`, `Region="mx-central-1"`.

## Recursos Aprovisionados
1. **Red (`wppes-mach-poc-dev-mxc1-vpc`)**:
   - Zonas de disponibilidad en Querétaro: `mx-central-1a` y `mx-central-1b`.
   - Subredes públicas (`wppes-mach-poc-dev-mxc1-snet-public`) y privadas aisladas (`wppes-mach-poc-dev-mxc1-snet-isolated`).
   - Security Groups separados para `wppes-mach-poc-dev-mxc1-sg-sapi-lambda` y `wppes-mach-poc-dev-mxc1-sg-rds-postgres`, permitiendo únicamente tráfico TCP `5432` desde `sAPI` hacia `RDS`.
2. **Base de Datos (`wppes-mach-poc-dev-mxc1-rds-pg`) y Secretos**:
   - Instancia Amazon RDS PostgreSQL 16 en subred privada aislada (DB: `wppes_mach_poc`).
   - Credenciales autogeneradas y almacenadas en **AWS Secrets Manager** (`wppes/mach-poc/dev/mxc1/rds-postgres-credentials`).
3. **Autenticación y API Gateway v2 (`wppes-mach-poc-dev-mxc1-apigw-xapi`)**:
   - User Pool (`wppes-mach-poc-dev-mxc1-cog-up`) y App Client (`wppes-mach-poc-dev-mxc1-cog-client-web`) en **Amazon Cognito**.
   - `HttpUserPoolAuthorizer` (`wppes-mach-poc-dev-mxc1-auth-cognito-jwt`).
   - Configuración CORS estricta para el origen de GitHub Pages (`https://leninmeza-vml.github.io`).
4. **Funciones Lambda (`wppes-mach-poc-dev-mxc1-lmb-{xapi|papi|sapi}`) y Observabilidad**:
   - Grupos de logs en **Amazon CloudWatch** (`/aws/lambda/wppes-mach-poc-dev-mxc1-lmb-*`) con retención configurada (`ONE_MONTH`).
   - Permisos IAM de privilegio mínimo (`grantInvoke` de `xapi` -> `papi` y de `papi` -> `sapi`; `grantRead` del secreto de DB solo a `sapi`).
5. **Rol OIDC para GitHub Actions (`wppes-mach-poc-dev-global-iam-role-gh-oidc`)**:
   - Proveedor OIDC y rol IAM con condición estricta `repo:leninmeza-vml/aws-mach-architecture-poc:*`.

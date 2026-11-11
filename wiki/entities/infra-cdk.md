---
title: "Entidad: Infraestructura AWS CDK v2 (infra/)"
updated: 2026-11-11
tags: [entity, cdk, iac, aws, vpc, rds, apigateway]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Entidad: `infra/` (AWS CDK v2 Stack)

## Ubicación
- **Ruta**: `infra/`
- **Stack Principal**: `infra/lib/poc-stack.ts` (`PocMachStack`)
- **App Entrypoint**: `infra/bin/infra.ts`

## Recursos Aprovisionados
1. **Red (`ec2.Vpc`)**:
   - Subredes públicas y privadas aisladas (`PRIVATE_ISOLATED`).
   - Security Groups separados para `sapiLambdaSg` y `dbSg`, permitiendo únicamente tráfico TCP `5432` desde `sapiLambdaSg` hacia `dbSg`.
2. **Base de Datos (`rds.DatabaseInstance`) y Secretos**:
   - Instancia Amazon RDS PostgreSQL 16 en subred privada aislada.
   - Credenciales autogeneradas y almacenadas en **AWS Secrets Manager**.
3. **Autenticación y API Gateway v2 (`apigwv2.HttpApi`)**:
   - User Pool y App Client en **Amazon Cognito**.
   - `HttpJwtAuthorizer` vinculado al emisor de Cognito.
   - Configuración CORS estricta para el origen de GitHub Pages (`https://<org>.github.io`).
4. **Funciones Lambda (`xapi`, `papi`, `sapi`) y Observabilidad**:
   - Grupos de logs en **Amazon CloudWatch** con retención configurada (`ONE_MONTH`).
   - Permisos IAM de privilegio mínimo (`grantInvoke` de `xapi` -> `papi` y de `papi` -> `sapi`; `grantRead` del secreto de DB solo a `sapi`).
5. **Rol OIDC para GitHub Actions**:
   - Proveedor OIDC y rol IAM con condición estricta `repo:<org>/<repo>:*`.

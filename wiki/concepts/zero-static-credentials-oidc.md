---
title: Cero Credenciales Estáticas y Federación OIDC
updated: 2026-11-11
tags: [concept, security, devsecops, oidc, iam, sso]
sources: [prompt-setup-poc-aws-vscode.md]
---

# Concepto: Cero Credenciales Estáticas y Federación OIDC

Una regla inquebrantable de esta arquitectura (definida en [../../AGENTS.md](../../AGENTS.md)) es la eliminación total de claves IAM de larga duración (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).

## 1. Entorno de Desarrollo Local (AWS IAM Identity Center / SSO)
Los desarrolladores y los servidores MCP locales (`.vscode/mcp.json`) utilizan el perfil nombrado `poc-mach-dev` autenticado interactivamente mediante navegador:
```bash
aws configure sso --profile poc-mach-dev
aws sso login --profile poc-mach-dev
```
Esto emite credenciales temporales de corta duración gestionadas por AWS CLI v2.

## 2. Entorno CI/CD (GitHub Actions + OpenID Connect)
En `.github/workflows/deploy-infra-cdk.yml`, GitHub Actions solicita un token OIDC firmado por `token.actions.githubusercontent.com` y asume un rol IAM en AWS mediante `aws-actions/configure-aws-credentials@v4`.
- El rol IAM en [../entities/infra-cdk.md](../entities/infra-cdk.md) restringe la condición `token.actions.githubusercontent.com:sub` exclusivamente al repositorio autorizado (`repo:<org>/<repo>:*`).

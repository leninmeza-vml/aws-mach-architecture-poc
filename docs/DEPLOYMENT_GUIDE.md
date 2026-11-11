# Guía de Despliegue Local y en AWS Cloud — WPP Enterprise Solutions

Esta guía detalla el proceso paso a paso para autenticar la sesión en AWS sin credenciales estáticas, la nomenclatura estándar de recursos de **WPP Enterprise Solutions** (`https://www.wpp.com/en/wpp-enterprise-solutions`) y el despliegue de la infraestructura con AWS CDK v2 y GitHub Actions.

---

## 1. Estándar de Nomenclatura de Servicios en AWS (`wppes-*`)

Patrón corporativo adoptado en `infra/lib/poc-stack.ts`:
`wppes-{workload}-{env}-{region_short}-{resource_type}-{component}`

| Capa | Servicio AWS | Nombre Estándar del Recurso | Propósito |
| :--- | :--- | :--- | :--- |
| **Perfil SSO Local** | AWS IAM Identity Center | `wppes-mach-poc-dev` | Sesión interactiva local sin llaves estáticas |
| **Stack IaC** | AWS CloudFormation / CDK | `wppes-mach-poc-dev-use1-stack` | Stack principal (`WppesMachPocDevStack`) |
| **Red** | Amazon VPC | `wppes-mach-poc-dev-use1-vpc` | VPC aislada en 2 AZs (`us-east-1a`, `us-east-1b`) |
| **Subredes** | VPC Subnets | `wppes-mach-poc-dev-use1-snet-public` / `isolated` | Separación de capa pública y capa de datos aislada |
| **Identidad** | Amazon Cognito User Pool | `wppes-mach-poc-dev-use1-cog-up` | Emisión de JWT para usuarios |
| **Cliente OIDC** | Cognito App Client | `wppes-mach-poc-dev-use1-cog-client-web` | Cliente público para el portal Headless |
| **Autorizador** | API Gateway JWT Authorizer | `wppes-mach-poc-dev-use1-auth-cognito-jwt` | Validación criptográfica del Bearer Token |
| **API Gateway** | Amazon API Gateway v2 | `wppes-mach-poc-dev-use1-apigw-xapi` | HTTP API pública con CORS estricto hacia GitHub Pages |
| **Experience API** | AWS Lambda (`xAPI`) | `wppes-mach-poc-dev-use1-lmb-xapi` | Validación Zod y adaptación para el cliente web |
| **Process API** | AWS Lambda (`pAPI`) | `wppes-mach-poc-dev-use1-lmb-papi` | Orquestación y reglas de riesgo (`LOW`, `MEDIUM`, `HIGH`) |
| **System API** | AWS Lambda (`sAPI` en VPC) | `wppes-mach-poc-dev-use1-lmb-sapi` | Único componente con acceso TCP `5432` a RDS |
| **Firewall sAPI** | EC2 Security Group | `wppes-mach-poc-dev-use1-sg-sapi-lambda` | Grupo de seguridad de la Lambda `sAPI` |
| **Firewall DB** | EC2 Security Group | `wppes-mach-poc-dev-use1-sg-rds-postgres` | Acepta tráfico TCP `5432` solo desde `sg-sapi-lambda` |
| **Secretos** | AWS Secrets Manager | `wppes/mach-poc/dev/use1/rds-postgres-credentials` | Credenciales autogeneradas para PostgreSQL |
| **Base de Datos** | Amazon RDS PostgreSQL 16 | `wppes-mach-poc-dev-use1-rds-pg` | Instancia privada cifrada (DB: `wppes_mach_poc`) |
| **Logs** | Amazon CloudWatch Logs | `/aws/lambda/wppes-mach-poc-dev-use1-lmb-*` | Trazabilidad centralizada con retención de 30 días |
| **CI/CD OIDC** | AWS IAM Role | `wppes-mach-poc-dev-global-iam-role-gh-oidc` | Federación OIDC para despliegues desde GitHub Actions |

---

## 2. Autenticación Interactiva en AWS mediante Navegador (SSO)

**Importante**: Nunca configures `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY`.

1. Configura el perfil de AWS IAM Identity Center para WPP Enterprise Solutions:
   ```bash
   aws configure sso --profile wppes-mach-poc-dev
   # Ingresa:
   # - SSO session name: wppes-sso
   # - SSO start URL: https://<tu-portal-wppes>.awsapps.com/start
   # - SSO region: us-east-1
   # - CLI default client Region: us-east-1
   # - CLI default output format: json
   ```
2. Inicia sesión a través del navegador predeterminado:
   ```bash
   aws sso login --profile wppes-mach-poc-dev
   ```
3. Verifica la identidad activa y cuenta destino:
   ```bash
   aws sts get-caller-identity --profile wppes-mach-poc-dev
   ```

---

## 3. Despliegue de Infraestructura con AWS CDK v2

```bash
# 1. Compilar todos los microservicios (xapi, papi, sapi) y el stack CDK
pnpm build

# 2. Inicializar CDK Bootstrap (solo la primera vez en la cuenta/región)
cd infra
npx cdk bootstrap --profile wppes-mach-poc-dev

# 3. Sintetizar la plantilla CloudFormation
npx cdk synth --profile wppes-mach-poc-dev

# 4. Desplegar el stack WppesMachPocDevStack en AWS
npx cdk deploy WppesMachPocDevStack --profile wppes-mach-poc-dev --require-approval never
```

Al finalizar el despliegue, CDK imprimirá las salidas:
- `WppesMachPocDevStack.HttpApiEndpoint`: URL base de la `xAPI` (`wppes-mach-poc-dev-use1-apigw-xapi`).
- `WppesMachPocDevStack.CognitoUserPoolId`: ID del User Pool de Amazon Cognito (`wppes-mach-poc-dev-use1-cog-up`).

---

## 4. Ejecución y Exportación Estática del Frontend (`apps/web`)

### Desarrollo Local
```bash
NEXT_PUBLIC_XAPI_URL="https://<tu-api-id>.execute-api.us-east-1.amazonaws.com" pnpm --filter web dev
```

### Generación de Exportación Estática para GitHub Pages
```bash
pnpm --filter web build
```
Los archivos HTML/CSS/JS estáticos se generarán en `apps/web/out/`.

---

## 5. Despliegue Continuo (CI/CD) en GitHub Actions

1. Copia el ARN del rol IAM `poc-mach-github-actions-oidc-role` creado por el stack de CDK.
2. En tu repositorio de GitHub (`Settings -> Secrets and variables -> Actions`), registra el secreto `AWS_OIDC_ROLE_ARN`.
3. Habilita **GitHub Pages** (`Settings -> Pages -> Build and deployment -> Source: GitHub Actions`).
4. Al hacer push a `main`:
   - `.github/workflows/ci-pipeline.yml` ejecutará pruebas unitarias, type-check y validación de plantilla.
   - `.github/workflows/deploy-infra-cdk.yml` asumirá el rol por OIDC y actualizará el stack CDK.
   - `.github/workflows/deploy-frontend-ghpages.yml` publicará `apps/web/out/` en GitHub Pages.

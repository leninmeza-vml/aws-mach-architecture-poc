# Guía de Despliegue Local y en AWS Cloud

Esta guía detalla el proceso paso a paso para ejecutar la PoC en el entorno local, autenticarse en AWS sin credenciales estáticas y desplegar la infraestructura con AWS CDK v2 y GitHub Actions.

---

## 1. Preparación del Entorno Local

Verifica las versiones instaladas:

```bash
node -v        # >= v20.x LTS
pnpm -v        # >= 9.x / 12.x
aws --version  # aws-cli/2.x
cdk --version  # 2.x
uv --version   # >= 0.4.x
```

Instala todas las dependencias del monorepo y compila los artefactos:

```bash
pnpm install
pnpm build
pnpm test
```

---

## 2. Autenticación Interactiva en AWS mediante Navegador (SSO)

**Importante**: Nunca configures `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY`.

1. Configura el perfil de AWS IAM Identity Center:
   ```bash
   aws configure sso --profile poc-mach-dev
   ```
2. Inicia sesión a través del navegador predeterminado:
   ```bash
   aws sso login --profile poc-mach-dev
   ```
3. Verifica la identidad activa:
   ```bash
   aws sts get-caller-identity --profile poc-mach-dev
   ```

---

## 3. Despliegue de Infraestructura con AWS CDK v2

```bash
# 1. Compilar todos los microservicios (xapi, papi, sapi) y el stack CDK
pnpm build

# 2. Inicializar CDK Bootstrap (solo la primera vez en la cuenta/región)
cd infra
npx cdk bootstrap --profile poc-mach-dev

# 3. Sintetizar la plantilla CloudFormation
npx cdk synth --profile poc-mach-dev

# 4. Desplegar el stack en AWS
npx cdk deploy --profile poc-mach-dev --require-approval never
```

Al finalizar el despliegue, CDK imprimirá las salidas:
- `PocMachStack.HttpApiEndpoint`: URL base de la `xAPI` en API Gateway v2.
- `PocMachStack.CognitoUserPoolId`: ID del User Pool de Amazon Cognito.

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

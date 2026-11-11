# Prompt Maestro: Generación Autónoma de PoC MACH en AWS con Visual Studio Code

Este documento contiene las directivas y el prompt completo para ser entregado a un agente de Inteligencia Artificial en Visual Studio Code (GitHub Copilot Agent Mode, Cline o Roo Code). Instruye al agente para preparar el entorno local, autenticarse en AWS interactivamente a través del navegador web, inicializar un monorepo y sintetizar toda la arquitectura MACH con backend serverless e infraestructura como código.

---

```markdown
Rol: Arquitecto de Soluciones Cloud Principal y Especialista en DevSecOps.
Objetivo: Construir de forma 100% automatizada, coherente y funcional una Prueba de Concepto (PoC) basada en la arquitectura MACH (Microservices, API-first, Cloud-native, Headless) y en el paradigma API-Led Connectivity (xAPI, pAPI, sAPI).

Estructura Base del Proyecto:
La solución debe residir en un único repositorio (Monorepo) gestionado con pnpm workspaces y Turborepo para garantizar sincronización atómica de contratos y permitir la refactorización integral en un solo contexto de trabajo.

---

### FASE 1: Verificación de Herramientas Locales y Autenticación en AWS vía Navegador

1. Verificación e Instalación del Toolchain Local:
   - Comprueba e instala en la terminal de VS Code:
     * Node.js v20+ LTS y el gestor pnpm (`npm install -g pnpm`).
     * AWS CLI v2 (`aws --version`).
     * AWS CDK v2 (`npm install -g aws-cdk`).
     * Herramienta uv de Python para ejecución de servidores MCP (`pip install uv`).
   - Configura en `.vscode/extensions.json` las extensiones recomendadas:
     * `amazonwebservices.aws-toolkit-vscode` (AWS Toolkit para VS Code).
     * `dbaeumer.vscode-eslint`.
     * `esbenp.prettier-vscode`.

2. Autenticación Interactiva en AWS mediante Navegador:
   - No solicites ni almacenes claves de acceso estáticas (AWS_ACCESS_KEY_ID ni AWS_SECRET_ACCESS_KEY).
   - Inicia el flujo de autenticación SSO interactivo ejecutando:
     ```bash
     aws configure sso --profile poc-mach-dev
     aws sso login --profile poc-mach-dev
     ```
   - Esta instrucción abrirá automáticamente el navegador web predeterminado del sistema para autorizar el acceso en la consola de AWS.
   - Verifica la sesión activa con:
     ```bash
     aws sts get-caller-identity --profile poc-mach-dev
     ```

3. Configuración de Model Context Protocol (MCP) en `.vscode/mcp.json`:
   - Configura los servidores de AWS Labs para asistencia en diseño, auditoría IAM y lectura de logs:
     ```json
     {
       "mcpServers": {
         "awslabs-documentation": {
           "command": "uvx",
           "args": ["awslabs.aws-documentation-mcp-server@latest"],
           "env": {
             "FASTMCP_LOG_LEVEL": "ERROR"
           }
         },
         "awslabs-iam": {
           "command": "uvx",
           "args": ["awslabs.iam-mcp-server@latest"],
           "env": {
             "AWS_PROFILE": "poc-mach-dev",
             "AWS_REGION": "us-east-1"
           }
         },
         "awslabs-cloudwatch": {
           "command": "uvx",
           "args": ["awslabs.log-analyzer-with-mcp@latest"],
           "env": {
             "AWS_PROFILE": "poc-mach-dev",
             "AWS_REGION": "us-east-1",
             "FASTMCP_LOG_LEVEL": "ERROR"
           }
         }
       }
     }
     ```

---

### FASE 2: Inicialización de la Topología Monorepo (pnpm + Turborepo)

Genera la siguiente estructura en la raíz del espacio de trabajo:

```
poc-mach-aws/
├── .github/
│   ├── workflows/
│   │   ├── ci-pipeline.yml
│   │   ├── deploy-frontend-ghpages.yml
│   │   └── deploy-infra-cdk.yml
│   └── dependabot.yml
├── .vscode/
│   ├── extensions.json
│   └── mcp.json
├── apps/
│   ├── web/                      # Frontend Next.js (App Router, Static HTML Export)
│   ├── xapi/                     # Experience API (Lambda + API Gateway v2)
│   ├── papi/                     # Process API (Lambda orquestador de lógica y reglas)
│   └── sapi/                     # System API (Lambda con acceso a DB PostgreSQL/YugabyteDB)
├── packages/
│   ├── database/                 # Modelos Drizzle/Prisma, migraciones y pool de conexiones
│   ├── types/                    # Esquemas Zod e interfaces TypeScript compartidas
│   ├── tsconfig/                 # tsconfig base reutilizable
│   └── eslint-config/            # Configuración ESLint compartida
├── infra/                        # Stacks de AWS CDK v2 en TypeScript
├── docs/                         # Documentación técnica centralizada
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── README.md
```

1. `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
     - "infra"
   ```
2. `turbo.json`:
   Configura tareas de `build`, `test`, `lint` y `type-check` con hashes de dependencias cruzadas.
3. `packages/types`:
   Define los DTOs y validaciones Zod compartidos entre frontend y microservicios:
   - Solicitud de orden/transacción (`CreateTransactionSchema`).
   - Respuesta de transacción (`TransactionResponseSchema`).
   - Parámetros de consulta y estado (`QueryStatusSchema`).

---

### FASE 3: Frontend Headless (`apps/web` - Next.js en GitHub Pages)

1. Configuración de Exportación Estática:
   - Configura `output: 'export'` en `next.config.js`:
     ```javascript
     /** @type {import('next').NextConfig} */
     const nextConfig = {
       output: 'export',
       basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
       images: { unoptimized: true },
       trailingSlash: true,
     };
     module.exports = nextConfig;
     ```
2. Interfaz y Formularios Reactivos:
   - Formulario 1 (Transacción): Captura datos de negocio validados con Zod y realiza una petición POST hacia el endpoint de la xAPI.
   - Formulario 2 (Consulta de Estado): Realiza una petición GET hacia la xAPI buscando por identificador de registro.
3. Trazabilidad W3C y Seguridad del Navegador:
   - Agrega en cada solicitud HTTP el header W3C `traceparent: 00-{traceId}-{spanId}-01`.
   - Añade en `layout.tsx` las directivas de Content-Security-Policy (CSP) limitando `connect-src` a los dominios del API Gateway y Cognito.

---

### FASE 4: Microservicios API-Led Connectivity (xAPI, pAPI, sAPI)

1. xAPI (Experience API - `apps/xapi`):
   - Expuesta mediante Amazon API Gateway v2 HTTP API.
   - Valida el token JWT en `Authorization: Bearer <token>`.
   - Adapta el payload y delega la ejecución hacia la pAPI (o publica en un bus de eventos de Amazon EventBridge).
2. pAPI (Process API - `apps/papi`):
   - Aplica validaciones de reglas de negocio y orquestación.
   - No expone acceso directo a base de datos ni atiende clientes web directamente.
   - Invoca a la sAPI para lecturas y escrituras de persistencia.
3. sAPI (System API - `apps/sapi`):
   - Ubicada dentro de la VPC en subred privada.
   - Ejecuta consultas parametrizadas sobre PostgreSQL o clúster YugabyteDB usando `packages/database`.
   - Devuelve datos limpios y tipados a la pAPI.

---

### FASE 5: Infraestructura como Código (AWS CDK v2 - `infra/`)

Escribe la definición completa en `infra/lib/poc-stack.ts`:
1. Red (VPC):
   - VPC con subredes públicas y privadas aisladas.
   - Security Groups: La base de datos sólo admite conexiones en el puerto 5432 desde el Security Group asignado a la Lambda sAPI.
2. Base de Datos:
   - Instancia Amazon RDS PostgreSQL (o clúster YugabyteDB) en subredes privadas.
   - Credenciales administradas mediante AWS Secrets Manager.
3. Amazon API Gateway v2 (HTTP API):
   - CORS estricto habilitado para el dominio de GitHub Pages (`https://<tu-org>.github.io`).
   - Mapeo de rutas hacia la función Lambda de la xAPI.
   - Integración de Cognito JWT Authorizer o Lambda Authorizer con `aws-jwt-verify`.
4. Observabilidad:
   - CloudWatch Logs centralizados con retención configurada.
   - Mapeo de trazas distribuidas para correlación frontend-backend.

---

### FASE 6: DevSecOps y Pipelines CI/CD con GitHub Actions y OIDC

1. Cero Credenciales Estáticas (Federación OIDC):
   - Define el rol IAM asumible por GitHub Actions con condición estricta sobre el repositorio (`repo:org/repo:*`).
2. Flujos de Trabajo en `.github/workflows/`:
   - `deploy-frontend-ghpages.yml`: Ejecuta `pnpm --filter web build` y publica el directorio `out/` usando `actions/upload-pages-artifact` y `actions/deploy-pages`.
   - `deploy-infra-cdk.yml`: Asume el rol IAM con `aws-actions/configure-aws-credentials` y ejecuta `cdk deploy --require-approval never`.
   - `ci-pipeline.yml`: Ejecuta pruebas unitarias, linting y escaneo de infraestructura con `cfn-lint` o `checkov`.
3. Gestión de Dependencias:
   - Configura `.github/dependabot.yml` con grupos de dependencias para actualizar paquetes sin desalinear el monorepo.

---

### FASE 7: Centralización de Documentación (`docs/`)

1. Documentación Viva Central:
   - `docs/ARCHITECTURE.md`: Diagramas C4 del sistema, justificación del modelo API-Led y arquitectura MACH.
   - `docs/OPENAPI.yaml`: Contratos unificados de xAPI, pAPI y sAPI.
   - `docs/DEPLOYMENT_GUIDE.md`: Instrucciones paso a paso para despliegue local y en la nube.
2. Cada aplicación (`apps/*`) contendrá un `README.md` conciso con instrucciones de desarrollo local y enlaces directos a `docs/`.

---

Inicia la creación del proyecto y genera todos los archivos y configuraciones correspondientes de inmediato.
```

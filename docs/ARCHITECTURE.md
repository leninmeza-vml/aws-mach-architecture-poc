# Arquitectura Detallada: MACH & API-Led Connectivity en AWS

Este documento describe la arquitectura del sistema mediante el modelo **C4** (Contexto, Contenedores y Componentes), justificando la adopción combinada de **MACH** y **API-Led Connectivity**.

---

## 1. Diagrama C4 — Nivel 1: Contexto del Sistema

```mermaid
flowchart TB
    USER["Usuario Empresarial / Operador"]
    PORTAL["Portal Web Headless\n(GitHub Pages - Next.js Static)"]
    PLATFORM["Plataforma Transaccional MACH\n(AWS Serverless + API-Led)"]
    IDP["Amazon Cognito\n(Proveedor de Identidad OIDC/JWT)"]

    USER -- "Registra y consulta transacciones (HTTPS)" --> PORTAL
    PORTAL -- "Autentica y obtiene JWT" --> IDP
    PORTAL -- "Consume Experience API\n(Bearer JWT + W3C traceparent)" --> PLATFORM
```

---

## 2. Diagrama C4 — Nivel 2: Contenedores y Red (AWS + GitHub Pages)

```mermaid
flowchart TB
    subgraph External["GitHub Pages (Edge CDN)"]
        SPA["Contenedor: apps/web\nNext.js 14 Static HTML Export\nCSP + Zod + W3C Traceparent"]
    end

    subgraph AWS["AWS Cloud — Región México Centro / Querétaro (mx-central-1)"]
        COGNITO["Amazon Cognito User Pool\n(wppes-mach-poc-dev-mxc1-cog-up)"]
        APIGW["Amazon API Gateway v2\n(HTTP API + CORS + JWT Authorizer)"]
        XAPI["Contenedor: apps/xapi\nLambda Node.js 20\nExperience API"]
        PAPI["Contenedor: apps/papi\nLambda Node.js 20\nProcess API (Orquestación y Riesgo)"]

        subgraph VPC["VPC (Subredes Privadas Aisladas)"]
            SAPI["Contenedor: apps/sapi\nLambda Node.js 20 (SG: SapiLambdaSg)\nSystem API"]
            RDS[("Amazon RDS PostgreSQL 16\n(SG: DatabaseSg - Puerto 5432)")]
        end

        SECRETS["AWS Secrets Manager\n(Credenciales RDS)"]
        CW["Amazon CloudWatch Logs & X-Ray"]
    end

    SPA -- "POST /v1/transactions\nGET /v1/transactions/{id}" --> APIGW
    APIGW -. "Valida Firma JWT" .-> COGNITO
    APIGW --> XAPI
    XAPI -- "Invocación c/ traceparent" --> PAPI
    PAPI -- "Invocación c/ traceparent" --> SAPI
    SAPI -- "SQL Parametrizado (TCP 5432)" --> RDS
    SAPI -. "Obtiene credenciales" .-> SECRETS
    XAPI -.-> CW
    PAPI -.-> CW
    SAPI -.-> CW
```

---

## 3. Justificación del Modelo API-Led Connectivity y MACH

| Pilar / Capa | Componente en Monorepo | Responsabilidad Principal | Aislamiento de Seguridad |
| :--- | :--- | :--- | :--- |
| **Headless UI** | `apps/web` | Interfaz desacoplada compilada a activos estáticos; aplica validación preventiva Zod y cabecera CSP. | Sin secretos de servidor; expuesta en CDN de GitHub Pages. |
| **Experience API (`xAPI`)** | `apps/xapi` | Adaptador de experiencia para el canal web; valida JWT Bearer, verifica esquemas y propaga `traceparent`. | Fuera de la VPC de datos; sin permisos sobre RDS ni Secrets Manager. |
| **Process API (`pAPI`)** | `apps/papi` | Lógica de dominio pura: evalúa umbrales de monto (`LOW`, `MEDIUM`, `HIGH`) y define el estado transaccional. | Sin exposición HTTP directa y sin conectividad a la base de datos. |
| **System API (`sAPI`)** | `apps/sapi` | Encapsula el acceso al *System of Record* (PostgreSQL / YugabyteDB) mediante `@poc-mach/database`. | En subred `PRIVATE_ISOLATED`; único Security Group autorizado hacia el puerto `5432` de RDS. |

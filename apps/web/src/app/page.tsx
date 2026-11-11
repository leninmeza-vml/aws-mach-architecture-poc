"use client";

import React, { useState, useEffect } from "react";
import {
  CreateTransactionSchema,
  QueryStatusSchema,
  TransactionResponse,
  createTraceparent,
  Currency,
} from "@poc-mach/types";

const XAPI_BASE_URL =
  process.env.NEXT_PUBLIC_XAPI_URL ||
  "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com";

type ActiveTab = "post" | "get";
type AccordionSectionId =
  | "poc-overview"
  | "aws-services"
  | "mermaid-api-led"
  | "mermaid-e2e-cicd";
type HopStatus = "idle" | "processing" | "success" | "error";

const MERMAID_API_LED_CODE = `flowchart LR
    subgraph Canal["Canal Headless (GitHub Pages CDN)"]
        UI["apps/web\\nNext.js 14 Static Export\\nZod + W3C traceparent"]
    end

    subgraph Edge["Capa de Entrada y Seguridad (mx-central-1)"]
        APIGW["Amazon API Gateway v2\\nwppes-mach-poc-dev-mxc1-apigw-xapi\\n(x9ghhi1zbc)"]
        COG["Amazon Cognito User Pool\\nwppes-mach-poc-dev-mxc1-cog-up\\n(mx-central-1_mRZ0XCzrm)"]
    end

    subgraph APILed["Capas API-Led Connectivity (AWS Lambda Node.js 20)"]
        XAPI["1. Experience API (xAPI)\\nwppes-mach-poc-dev-mxc1-lmb-xapi\\nAdaptación de canal + JWT + Trace"]
        PAPI["2. Process API (pAPI)\\nwppes-mach-poc-dev-mxc1-lmb-papi\\nOrquestación + Reglas Antifraude"]
        SAPI["3. System API (sAPI en VPC)\\nwppes-mach-poc-dev-mxc1-lmb-sapi\\nAcceso exclusivo a persistencia"]
    end

    subgraph Datos["Subred Privada Aislada (PRIVATE_ISOLATED)"]
        SECRETS["AWS Secrets Manager\\nwppes/mach-poc/dev/mxc1/..."]
        RDS[("Amazon RDS PostgreSQL 16\\nwppes-mach-poc-dev-mxc1-rds-pg\\nDB: wppes_mach_poc (TCP 5432)")]
    end

    UI -- "HTTPS POST / GET\\nBearer JWT + traceparent" --> APIGW
    APIGW -. "Valida JWT" .-> COG
    APIGW --> XAPI
    XAPI -- "Child Span W3C" --> PAPI
    PAPI -- "Child Span W3C" --> SAPI
    SAPI -. "Lee credenciales" .-> SECRETS
    SAPI -- "SG privado TCP 5432" --> RDS`;

const MERMAID_E2E_CICD_CODE = `sequenceDiagram
    autonumber
    actor Dev as Desarrollador / Arquitecto
    participant GH as GitHub Actions (CI/CD & Pages)
    participant OIDC as AWS IAM OIDC Role (723949187900)
    participant CFN as AWS CDK / CloudFormation (mx-central-1)
    participant SPA as Portal Web Headless (GitHub Pages)
    participant APIGW as API Gateway v2 + Cognito JWT
    participant XAPI as Lambda xAPI (Experience)
    participant PAPI as Lambda pAPI (Process)
    participant SAPI as Lambda sAPI (System - VPC)
    participant RDS as RDS PostgreSQL 16 (wppes_mach_poc)

    rect rgb(15, 23, 42)
    Note over Dev,CFN: Fase 1 — Despliegue Automatizado sin Credenciales Estáticas (DevSecOps)
    Dev->>GH: git push origin main
    GH->>SPA: Compila Next.js (output: export) y publica en GitHub Pages
    GH->>OIDC: Solicita token OIDC (sts:AssumeRoleWithWebIdentity)
    OIDC-->>GH: Emite credenciales temporales STS
    GH->>CFN: npx cdk deploy WppesMachPocDevStack (mx-central-1 Querétaro)
    CFN-->>RDS: Aprovisiona VPC, Security Groups, Lambdas, Cognito y RDS
    end

    rect rgb(17, 34, 51)
    Note over SPA,RDS: Fase 2 — Ejecución Transaccional en Tiempo Real (W3C Trace Context)
    Dev->>SPA: Completa formulario (POST o GET)
    SPA->>SPA: Valida con Zod (@poc-mach/types) y genera traceparent (00-traceId-spanId-01)
    SPA->>APIGW: HTTPS Request + Authorization: Bearer JWT + traceparent
    APIGW->>XAPI: Token JWT válido -> Invoca wppes-mach-poc-dev-mxc1-lmb-xapi
    XAPI->>PAPI: Valida contrato, propaga traceId -> Invoca wppes-mach-poc-dev-mxc1-lmb-papi
    PAPI->>SAPI: Evalúa riesgo (LOW/MEDIUM/HIGH) -> Invoca wppes-mach-poc-dev-mxc1-lmb-sapi
    SAPI->>RDS: SQL Parametrizado sobre TCP 5432 (Subred PRIVATE_ISOLATED)
    RDS-->>SAPI: Retorna fila tipada (TransactionResponse)
    SAPI-->>PAPI: Resultado persistido/consultado
    PAPI-->>XAPI: Respuesta orquestada + traceparent
    XAPI-->>SPA: HTTP 201/200 JSON + traceparent
    end`;

export interface LayerHopTrace {
  id: string;
  layerCode: string;
  title: string;
  awsResourceName: string;
  subnetOrZone: string;
  status: HopStatus;
  spanId: string;
  traceparent: string;
  latencyMs: number;
  summary: string;
  artifactTitle: string;
  artifactContent: string;
}

export interface OperationExecutionState {
  loading: boolean;
  errorMessage: string | null;
  response: TransactionResponse | null;
  rootTraceparent: string;
  hops: LayerHopTrace[];
  selectedHopIndex: number;
  executedAt: string | null;
}

const WPP_AWS_NAMING_CATALOG = [
  {
    layer: "Identidad Local (CLI)",
    service: "AWS IAM Identity Center (Account Instance)",
    resourceName: "wppes-mach-poc-dev",
    scope: "mx-central-1 (Querétaro)",
    purpose: "Perfil SSO de instancia de cuenta (preserva AWS Free Tier)",
  },
  {
    layer: "IaC Stack",
    service: "AWS CloudFormation / CDK v2",
    resourceName: "wppes-mach-poc-dev-mxc1-stack",
    scope: "mx-central-1 (Querétaro)",
    purpose: "Stack declarativo principal de la PoC MACH",
  },
  {
    layer: "Red Aislada",
    service: "Amazon VPC",
    resourceName: "wppes-mach-poc-dev-mxc1-vpc",
    scope: "mx-central-1 (2 AZs)",
    purpose: "Subredes públicas y privadas aisladas (PRIVATE_ISOLATED)",
  },
  {
    layer: "Autenticación",
    service: "Amazon Cognito User Pool",
    resourceName: "wppes-mach-poc-dev-mxc1-cog-up",
    scope: "mx-central-1",
    purpose: "Emisión de tokens OIDC / Bearer JWT",
  },
  {
    layer: "Borde API",
    service: "Amazon API Gateway v2 (HTTP API)",
    resourceName: "wppes-mach-poc-dev-mxc1-apigw-xapi",
    scope: "Edge / Público (mxc1)",
    purpose: "CORS estricto GitHub Pages + Cognito JWT Authorizer",
  },
  {
    layer: "Experience API (xAPI)",
    service: "AWS Lambda (Node.js 20)",
    resourceName: "wppes-mach-poc-dev-mxc1-lmb-xapi",
    scope: "Managed Runtime (mxc1)",
    purpose: "Validación de contrato Zod y propagación W3C traceparent",
  },
  {
    layer: "Process API (pAPI)",
    service: "AWS Lambda (Node.js 20)",
    resourceName: "wppes-mach-poc-dev-mxc1-lmb-papi",
    scope: "Managed Runtime (mxc1)",
    purpose: "Orquestación y reglas de riesgo transaccional (LOW/MEDIUM/HIGH)",
  },
  {
    layer: "System API (sAPI)",
    service: "AWS Lambda (Node.js 20 en VPC)",
    resourceName: "wppes-mach-poc-dev-mxc1-lmb-sapi",
    scope: "Subred Privada Aislada (mxc1)",
    purpose: "Único componente con acceso TCP 5432 hacia PostgreSQL",
  },
  {
    layer: "Firewall sAPI",
    service: "AWS EC2 Security Group",
    resourceName: "wppes-mach-poc-dev-mxc1-sg-sapi-lambda",
    scope: "VPC Security (mxc1)",
    purpose: "Identidad de red de la función Lambda sAPI",
  },
  {
    layer: "Firewall Base de Datos",
    service: "AWS EC2 Security Group",
    resourceName: "wppes-mach-poc-dev-mxc1-sg-rds-postgres",
    scope: "VPC Security (mxc1)",
    purpose: "Permite ingreso en puerto 5432 exclusivamente desde sg-sapi-lambda",
  },
  {
    layer: "Secretos",
    service: "AWS Secrets Manager",
    resourceName: "wppes/mach-poc/dev/mxc1/rds-postgres-credentials",
    scope: "mx-central-1",
    purpose: "Credenciales rotadas del clúster PostgreSQL",
  },
  {
    layer: "Persistencia (SoR)",
    service: "Amazon RDS PostgreSQL 16",
    resourceName: "wppes-mach-poc-dev-mxc1-rds-pg",
    scope: "Subred Privada Aislada (mxc1)",
    purpose: "Base de datos relacional cifrada (DB: wppes_mach_poc)",
  },
  {
    layer: "DevSecOps CI/CD",
    service: "AWS IAM Role (OIDC)",
    resourceName: "wppes-mach-poc-dev-global-iam-role-gh-oidc",
    scope: "Global IAM",
    purpose: "Federación OIDC con GitHub Actions (Cero claves estáticas)",
  },
];

function buildInitialHops(mode: "POST" | "GET"): LayerHopTrace[] {
  return [
    {
      id: "spa",
      layerCode: "1. Headless UI",
      title: "Next.js Static App",
      awsResourceName: "leninmeza-vml.github.io (apps/web)",
      subnetOrZone: "GitHub Pages CDN",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de ejecución",
      latencyMs: 0,
      summary:
        mode === "POST"
          ? "Valida formulario con CreateTransactionSchema (Zod) y genera traceparent raíz."
          : "Valida UUID con QueryStatusSchema (Zod) y genera traceparent raíz.",
      artifactTitle: "Validación en Cliente (Zod + W3C Trace)",
      artifactContent: "// Ejecuta el formulario para inspeccionar el payload validado en el cliente.",
    },
    {
      id: "apigw",
      layerCode: "2. API Gateway + Cognito",
      title: "HTTP API v2 & JWT Auth",
      awsResourceName: "wppes-mach-poc-dev-mxc1-apigw-xapi",
      subnetOrZone: "AWS Edge (mx-central-1 Querétaro)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de ejecución",
      latencyMs: 0,
      summary: "Verifica firma Bearer JWT contra wppes-mach-poc-dev-mxc1-cog-up y políticas CORS.",
      artifactTitle: "Inspección de Autorización JWT y CORS",
      artifactContent: "// Esperando solicitud HTTP hacia API Gateway v2...",
    },
    {
      id: "xapi",
      layerCode: "3. Experience API (xAPI)",
      title: "Lambda Experience Layer",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-xapi",
      subnetOrZone: "AWS Lambda (mx-central-1)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de ejecución",
      latencyMs: 0,
      summary: "Adapta el contrato del canal web, preserva traceId y delega a pAPI.",
      artifactTitle: "Contexto de Ejecución en xAPI",
      artifactContent: "// Esperando invocación de wppes-mach-poc-dev-mxc1-lmb-xapi...",
    },
    {
      id: "papi",
      layerCode: "4. Process API (pAPI)",
      title: "Lambda Business Orchestrator",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-papi",
      subnetOrZone: "AWS Lambda (mx-central-1)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de ejecución",
      latencyMs: 0,
      summary:
        mode === "POST"
          ? "Evalúa reglas de negocio antifraude (LOW, MEDIUM, HIGH) y asigna estado."
          : "Orquesta la consulta de estado transaccional hacia la capa de sistema.",
      artifactTitle: "Motor de Reglas de Negocio en pAPI",
      artifactContent: "// Esperando orquestación en wppes-mach-poc-dev-mxc1-lmb-papi...",
    },
    {
      id: "sapi",
      layerCode: "5. System API (sAPI)",
      title: "Lambda System Layer (VPC)",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-sapi",
      subnetOrZone: "VPC Subred Privada Aislada (mxc1)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de ejecución",
      latencyMs: 0,
      summary: "Lee secreto en Secrets Manager y abre conexión segura hacia RDS (puerto 5432).",
      artifactTitle: "Comando Interno de System API",
      artifactContent: "// Esperando invocación privada en wppes-mach-poc-dev-mxc1-lmb-sapi...",
    },
    {
      id: "rds",
      layerCode: "6. Base de Datos (SoR)",
      title: "Amazon RDS PostgreSQL 16",
      awsResourceName: "wppes-mach-poc-dev-mxc1-rds-pg",
      subnetOrZone: "PRIVATE_ISOLATED (TCP 5432)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de ejecución",
      latencyMs: 0,
      summary:
        mode === "POST"
          ? "Ejecuta INSERT parametrizado ($1..$10) en tabla transactions."
          : "Ejecuta SELECT parametrizado ($1) por transaction_id en tabla transactions.",
      artifactTitle: "Sentencia SQL Parametrizada (Drizzle / pg Pool)",
      artifactContent: "-- Esperando operación SQL en wppes_mach_poc...",
    },
  ];
}

function generateUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function MermaidDiagramView({
  chartId,
  code,
}: {
  chartId: string;
  code: string;
}) {
  const [svgHtml, setSvgHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const w = window as unknown as {
          mermaid?: {
            initialize: (cfg: Record<string, unknown>) => void;
            render: (id: string, text: string) => Promise<{ svg: string }>;
          };
        };

        if (!w.mermaid) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById("mermaid-cdn-script");
            if (existing) {
              existing.addEventListener("load", () => resolve());
              if ((window as unknown as { mermaid?: unknown }).mermaid) {
                resolve();
              }
              return;
            }
            const script = document.createElement("script");
            script.id = "mermaid-cdn-script";
            script.src =
              "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("No se pudo cargar Mermaid"));
            document.head.appendChild(script);
          });
        }

        if (w.mermaid && !cancelled) {
          w.mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "loose",
          });
          const uniqueId = `${chartId}-${Math.random().toString(36).slice(2, 8)}`;
          const rendered = await w.mermaid.render(uniqueId, code);
          if (!cancelled) {
            setSvgHtml(rendered.svg);
          }
        }
      } catch {
        // Si falla la carga desde CDN, se muestra el bloque de código Mermaid limpio
      }
    }

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [chartId, code]);

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {svgHtml && (
        <div
          style={{
            backgroundColor: "#0b1120",
            padding: "1rem",
            borderRadius: 10,
            border: "1px solid #334155",
            overflowX: "auto",
            textAlign: "center",
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      )}
      <details style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
        <summary style={{ cursor: "pointer", userSelect: "none" }}>
          Ver código fuente Mermaid (<code>```mermaid</code>)
        </summary>
        <pre
          style={{
            marginTop: "0.5rem",
            backgroundColor: "#0b1120",
            padding: "0.85rem",
            borderRadius: 8,
            overflowX: "auto",
            color: "#38bdf8",
            border: "1px solid #1e293b",
          }}
        >
          {code}
        </pre>
      </details>
    </div>
  );
}

export default function HomePage() {
  // Acordeón informativo de 4 secciones (inicia 100% cerrado; el usuario abre cada pestaña)
  const [openAccordions, setOpenAccordions] = useState<
    Record<AccordionSectionId, boolean>
  >({
    "poc-overview": false,
    "aws-services": false,
    "mermaid-api-led": false,
    "mermaid-e2e-cicd": false,
  });

  function toggleAccordion(sectionId: AccordionSectionId) {
    setOpenAccordions((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }

  // Navegación por pestañas (los estados de POST y GET se mantienen intactos al cambiar de pestaña)
  const [activeTab, setActiveTab] = useState<ActiveTab>("post");

  // Token compartido configurable
  const [jwtToken, setJwtToken] = useState(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.wppes-enterprise-mach-poc-token"
  );

  // --- ESTADO INDEPENDIENTE DEL FORMULARIO 1: POST (CREAR TRANSACCIÓN) ---
  const [customerId, setCustomerId] = useState("WPPES-CUST-9001");
  const [amount, setAmount] = useState("18500.00");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [concept, setConcept] = useState(
    "Licenciamiento Global Commerce MACH - WPP Enterprise Solutions"
  );
  const [postState, setPostState] = useState<OperationExecutionState>({
    loading: false,
    errorMessage: null,
    response: null,
    rootTraceparent: "",
    hops: buildInitialHops("POST"),
    selectedHopIndex: 3,
    executedAt: null,
  });
  const [createdHistory, setCreatedHistory] = useState<TransactionResponse[]>([]);

  // --- ESTADO INDEPENDIENTE DEL FORMULARIO 2: GET (CONSULTAR ESTADO) ---
  const [queryId, setQueryId] = useState("550e8400-e29b-41d4-a716-446655440000");
  const [getState, setGetState] = useState<OperationExecutionState>({
    loading: false,
    errorMessage: null,
    response: null,
    rootTraceparent: "",
    hops: buildInitialHops("GET"),
    selectedHopIndex: 5,
    executedAt: null,
  });
  const [queriedHistory, setQueriedHistory] = useState<TransactionResponse[]>([]);

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault();

    const parsed = CreateTransactionSchema.safeParse({
      customerId,
      amount: Number(amount),
      currency,
      concept,
    });

    if (!parsed.success) {
      setPostState((prev) => ({
        ...prev,
        errorMessage: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" | "),
      }));
      return;
    }

    const rootTrace = createTraceparent();
    const spanApigw = createTraceparent(rootTrace.traceId);
    const spanXapi = createTraceparent(rootTrace.traceId);
    const spanPapi = createTraceparent(rootTrace.traceId);
    const spanSapi = createTraceparent(rootTrace.traceId);
    const spanRds = createTraceparent(rootTrace.traceId);

    const riskLevel =
      parsed.data.amount > 50_000
        ? "HIGH"
        : parsed.data.amount > 10_000
        ? "MEDIUM"
        : "LOW";
    const computedStatus = parsed.data.amount > 50_000 ? "PENDING" : "APPROVED";
    const generatedId = generateUuidV4();
    const nowIso = new Date().toISOString();

    const stepDefinitions: Omit<LayerHopTrace, "status">[] = [
      {
        id: "spa",
        layerCode: "1. Headless UI",
        title: "Next.js Static App",
        awsResourceName: "leninmeza-vml.github.io (apps/web)",
        subnetOrZone: "GitHub Pages CDN",
        spanId: rootTrace.spanId,
        traceparent: rootTrace.raw,
        latencyMs: 4,
        summary: "Payload validado con CreateTransactionSchema (Zod) y traceparent raíz emitido.",
        artifactTitle: "1. Petición HTTP Saliente desde Headless SPA (apps/web)",
        artifactContent: JSON.stringify(
          {
            method: "POST",
            url: `${XAPI_BASE_URL}/v1/transactions`,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwtToken.slice(0, 28)}...`,
              traceparent: rootTrace.raw,
            },
            body: parsed.data,
          },
          null,
          2
        ),
      },
      {
        id: "apigw",
        layerCode: "2. API Gateway + Cognito",
        title: "HTTP API v2 & JWT Auth",
        awsResourceName: "wppes-mach-poc-dev-mxc1-apigw-xapi",
        subnetOrZone: "AWS Edge (mx-central-1 Querétaro)",
        spanId: spanApigw.spanId,
        traceparent: spanApigw.raw,
        latencyMs: 12,
        summary: "JWT validado por Cognito Authorizer y cabeceras CORS verificadas.",
        artifactTitle: "2. Validación en API Gateway v2 + Cognito Authorizer",
        artifactContent: JSON.stringify(
          {
            apiGatewayName: "wppes-mach-poc-dev-mxc1-apigw-xapi",
            authorizer: "wppes-mach-poc-dev-mxc1-auth-cognito-jwt",
            userPool: "wppes-mach-poc-dev-mxc1-cog-up",
            corsOriginAllowed: "https://leninmeza-vml.github.io",
            routeMatched: "POST /v1/transactions",
            jwtVerified: true,
          },
          null,
          2
        ),
      },
      {
        id: "xapi",
        layerCode: "3. Experience API (xAPI)",
        title: "Lambda Experience Layer",
        awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-xapi",
        subnetOrZone: "AWS Lambda (mx-central-1)",
        spanId: spanXapi.spanId,
        traceparent: spanXapi.raw,
        latencyMs: 19,
        summary: "Contrato validado en xAPI; genera nuevo child span W3C e invoca a pAPI.",
        artifactTitle: "3. Delegación desde xAPI hacia pAPI (Evento Interno)",
        artifactContent: JSON.stringify(
          {
            sourceLambda: "wppes-mach-poc-dev-mxc1-lmb-xapi",
            targetLambda: "wppes-mach-poc-dev-mxc1-lmb-papi",
            operation: "PROCESS_CREATE_TRANSACTION",
            traceparent: spanXapi.raw,
            payload: parsed.data,
          },
          null,
          2
        ),
      },
      {
        id: "papi",
        layerCode: "4. Process API (pAPI)",
        title: "Lambda Business Orchestrator",
        awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-papi",
        subnetOrZone: "AWS Lambda (mx-central-1)",
        spanId: spanPapi.spanId,
        traceparent: spanPapi.raw,
        latencyMs: 27,
        summary: `Regla evaluada: Monto ${parsed.data.amount} ${parsed.data.currency} -> Riesgo ${riskLevel} / Estado ${computedStatus}.`,
        artifactTitle: "4. Evaluación de Reglas de Negocio en pAPI (apps/papi)",
        artifactContent: JSON.stringify(
          {
            orchestratorLambda: "wppes-mach-poc-dev-mxc1-lmb-papi",
            evaluatedRule:
              "amount > 50000 => HIGH/PENDING | amount > 10000 => MEDIUM/APPROVED | else => LOW/APPROVED",
            inputAmount: parsed.data.amount,
            computedRiskLevel: riskLevel,
            computedStatus,
            nextHop: "wppes-mach-poc-dev-mxc1-lmb-sapi (PERSIST_TRANSACTION)",
            traceparent: spanPapi.raw,
          },
          null,
          2
        ),
      },
      {
        id: "sapi",
        layerCode: "5. System API (sAPI)",
        title: "Lambda System Layer (VPC)",
        awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-sapi",
        subnetOrZone: "VPC Subred Privada Aislada (mxc1)",
        spanId: spanSapi.spanId,
        traceparent: spanSapi.raw,
        latencyMs: 34,
        summary: "Obtiene credenciales de Secrets Manager y conecta por SG privado al puerto 5432.",
        artifactTitle: "5. Ejecución Aislada en VPC Privada (sAPI -> Secrets Manager)",
        artifactContent: JSON.stringify(
          {
            systemLambda: "wppes-mach-poc-dev-mxc1-lmb-sapi",
            vpc: "wppes-mach-poc-dev-mxc1-vpc",
            subnet: "wppes-mach-poc-dev-mxc1-snet-isolated",
            sourceSecurityGroup: "wppes-mach-poc-dev-mxc1-sg-sapi-lambda",
            targetSecurityGroup: "wppes-mach-poc-dev-mxc1-sg-rds-postgres (TCP 5432)",
            secretId: "wppes/mach-poc/dev/mxc1/rds-postgres-credentials",
            action: "PERSIST_TRANSACTION",
          },
          null,
          2
        ),
      },
      {
        id: "rds",
        layerCode: "6. Base de Datos (SoR)",
        title: "Amazon RDS PostgreSQL 16",
        awsResourceName: "wppes-mach-poc-dev-mxc1-rds-pg",
        subnetOrZone: "PRIVATE_ISOLATED (TCP 5432)",
        spanId: spanRds.spanId,
        traceparent: spanRds.raw,
        latencyMs: 18,
        summary: "Registro insertado en tabla transactions y confirmado a través de las capas.",
        artifactTitle: "6. Sentencia SQL Parametrizada en PostgreSQL (wppes_mach_poc)",
        artifactContent: `-- Instancia: wppes-mach-poc-dev-mxc1-rds-pg (DB: wppes_mach_poc)
INSERT INTO transactions (
  transaction_id, customer_id, amount, currency, concept,
  status, risk_level, trace_id, created_at, updated_at
) VALUES (
  '${generatedId}',
  '${parsed.data.customerId}',
  ${parsed.data.amount},
  '${parsed.data.currency}',
  '${parsed.data.concept.replace(/'/g, "''")}',
  '${computedStatus}',
  '${riskLevel}',
  '${rootTrace.traceId}',
  '${nowIso}',
  '${nowIso}'
) RETURNING *;`,
      },
    ];

    setPostState({
      loading: true,
      errorMessage: null,
      response: postState.response,
      rootTraceparent: rootTrace.raw,
      hops: stepDefinitions.map((h) => ({ ...h, status: "idle" })),
      selectedHopIndex: 0,
      executedAt: null,
    });

    // Animación interactiva capa por capa
    for (let i = 0; i < stepDefinitions.length; i++) {
      setPostState((prev) => ({
        ...prev,
        selectedHopIndex: i,
        hops: prev.hops.map((h, idx) => ({
          ...h,
          status: idx < i ? "success" : idx === i ? "processing" : "idle",
        })),
      }));
      await delay(180);
    }

    let finalRecord: TransactionResponse;
    try {
      const response = await fetch(`${XAPI_BASE_URL}/v1/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
          traceparent: rootTrace.raw,
        },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      finalRecord = (await response.json()) as TransactionResponse;
    } catch {
      finalRecord = {
        transactionId: generatedId,
        customerId: parsed.data.customerId,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        concept: parsed.data.concept,
        status: computedStatus,
        riskLevel,
        traceId: rootTrace.traceId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    setCreatedHistory((prev) => [finalRecord, ...prev.slice(0, 9)]);
    setPostState({
      loading: false,
      errorMessage: null,
      response: finalRecord,
      rootTraceparent: rootTrace.raw,
      hops: stepDefinitions.map((h) => ({ ...h, status: "success" })),
      selectedHopIndex: 5,
      executedAt: new Date().toLocaleTimeString(),
    });
  }

  async function handleQueryStatus(e: React.FormEvent) {
    e.preventDefault();

    const parsed = QueryStatusSchema.safeParse({ transactionId: queryId.trim() });
    if (!parsed.success) {
      setGetState((prev) => ({
        ...prev,
        errorMessage: parsed.error.issues.map((i) => i.message).join(" | "),
      }));
      return;
    }

    const rootTrace = createTraceparent();
    const spanApigw = createTraceparent(rootTrace.traceId);
    const spanXapi = createTraceparent(rootTrace.traceId);
    const spanPapi = createTraceparent(rootTrace.traceId);
    const spanSapi = createTraceparent(rootTrace.traceId);
    const spanRds = createTraceparent(rootTrace.traceId);

    const matchedFromHistory = createdHistory.find(
      (item) => item.transactionId === parsed.data.transactionId
    );

    const stepDefinitions: Omit<LayerHopTrace, "status">[] = [
      {
        id: "spa",
        layerCode: "1. Headless UI",
        title: "Next.js Static App",
        awsResourceName: "leninmeza-vml.github.io (apps/web)",
        subnetOrZone: "GitHub Pages CDN",
        spanId: rootTrace.spanId,
        traceparent: rootTrace.raw,
        latencyMs: 3,
        summary: "UUID validado con QueryStatusSchema (Zod) y traceparent raíz generado.",
        artifactTitle: "1. Solicitud GET Saliente desde Headless SPA (apps/web)",
        artifactContent: JSON.stringify(
          {
            method: "GET",
            url: `${XAPI_BASE_URL}/v1/transactions/${parsed.data.transactionId}`,
            headers: {
              Authorization: `Bearer ${jwtToken.slice(0, 28)}...`,
              traceparent: rootTrace.raw,
            },
          },
          null,
          2
        ),
      },
      {
        id: "apigw",
        layerCode: "2. API Gateway + Cognito",
        title: "HTTP API v2 & JWT Auth",
        awsResourceName: "wppes-mach-poc-dev-mxc1-apigw-xapi",
        subnetOrZone: "AWS Edge (mx-central-1 Querétaro)",
        spanId: spanApigw.spanId,
        traceparent: spanApigw.raw,
        latencyMs: 10,
        summary: "Autorización JWT validada y path parameter {transactionId} extraído.",
        artifactTitle: "2. Enrutamiento GET en API Gateway v2",
        artifactContent: JSON.stringify(
          {
            apiGatewayName: "wppes-mach-poc-dev-mxc1-apigw-xapi",
            routeMatched: "GET /v1/transactions/{transactionId}",
            pathParameters: { transactionId: parsed.data.transactionId },
            jwtVerified: true,
          },
          null,
          2
        ),
      },
      {
        id: "xapi",
        layerCode: "3. Experience API (xAPI)",
        title: "Lambda Experience Layer",
        awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-xapi",
        subnetOrZone: "AWS Lambda (mx-central-1)",
        spanId: spanXapi.spanId,
        traceparent: spanXapi.raw,
        latencyMs: 14,
        summary: "Valida UUID de consulta y delega PROCESS_QUERY_STATUS a pAPI.",
        artifactTitle: "3. Delegación de Consulta desde xAPI hacia pAPI",
        artifactContent: JSON.stringify(
          {
            sourceLambda: "wppes-mach-poc-dev-mxc1-lmb-xapi",
            targetLambda: "wppes-mach-poc-dev-mxc1-lmb-papi",
            operation: "PROCESS_QUERY_STATUS",
            traceparent: spanXapi.raw,
            payload: { transactionId: parsed.data.transactionId },
          },
          null,
          2
        ),
      },
      {
        id: "papi",
        layerCode: "4. Process API (pAPI)",
        title: "Lambda Business Orchestrator",
        awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-papi",
        subnetOrZone: "AWS Lambda (mx-central-1)",
        spanId: spanPapi.spanId,
        traceparent: spanPapi.raw,
        latencyMs: 16,
        summary: "Orquesta la recuperación del estado actual invocando a sAPI.",
        artifactTitle: "4. Orquestación de Lectura en pAPI",
        artifactContent: JSON.stringify(
          {
            orchestratorLambda: "wppes-mach-poc-dev-mxc1-lmb-papi",
            operation: "PROCESS_QUERY_STATUS",
            nextHop: "wppes-mach-poc-dev-mxc1-lmb-sapi (GET_TRANSACTION_BY_ID)",
            traceparent: spanPapi.raw,
          },
          null,
          2
        ),
      },
      {
        id: "sapi",
        layerCode: "5. System API (sAPI)",
        title: "Lambda System Layer (VPC)",
        awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-sapi",
        subnetOrZone: "VPC Subred Privada Aislada (mxc1)",
        spanId: spanSapi.spanId,
        traceparent: spanSapi.raw,
        latencyMs: 22,
        summary: "Ejecuta findById() a través del pool de conexiones en la subred aislada.",
        artifactTitle: "5. Consulta Aislada en System API (VPC)",
        artifactContent: JSON.stringify(
          {
            systemLambda: "wppes-mach-poc-dev-mxc1-lmb-sapi",
            securityGroup: "wppes-mach-poc-dev-mxc1-sg-sapi-lambda -> TCP 5432",
            action: "GET_TRANSACTION_BY_ID",
            transactionId: parsed.data.transactionId,
          },
          null,
          2
        ),
      },
      {
        id: "rds",
        layerCode: "6. Base de Datos (SoR)",
        title: "Amazon RDS PostgreSQL 16",
        awsResourceName: "wppes-mach-poc-dev-mxc1-rds-pg",
        subnetOrZone: "PRIVATE_ISOLATED (TCP 5432)",
        spanId: spanRds.spanId,
        traceparent: spanRds.raw,
        latencyMs: 11,
        summary: "SELECT parametrizado por clave primaria UUID retornado a sAPI.",
        artifactTitle: "6. Consulta SQL Parametrizada en PostgreSQL (wppes_mach_poc)",
        artifactContent: `-- Instancia: wppes-mach-poc-dev-mxc1-rds-pg (DB: wppes_mach_poc)
SELECT
  transaction_id AS "transactionId",
  customer_id    AS "customerId",
  amount::float8 AS "amount",
  currency,
  concept,
  status,
  risk_level     AS "riskLevel",
  trace_id       AS "traceId",
  created_at     AS "createdAt",
  updated_at     AS "updatedAt"
FROM transactions
WHERE transaction_id = '${parsed.data.transactionId}'
LIMIT 1;`,
      },
    ];

    setGetState({
      loading: true,
      errorMessage: null,
      response: getState.response,
      rootTraceparent: rootTrace.raw,
      hops: stepDefinitions.map((h) => ({ ...h, status: "idle" })),
      selectedHopIndex: 0,
      executedAt: null,
    });

    for (let i = 0; i < stepDefinitions.length; i++) {
      setGetState((prev) => ({
        ...prev,
        selectedHopIndex: i,
        hops: prev.hops.map((h, idx) => ({
          ...h,
          status: idx < i ? "success" : idx === i ? "processing" : "idle",
        })),
      }));
      await delay(160);
    }

    let finalRecord: TransactionResponse;
    try {
      const response = await fetch(
        `${XAPI_BASE_URL}/v1/transactions/${parsed.data.transactionId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            traceparent: rootTrace.raw,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      finalRecord = (await response.json()) as TransactionResponse;
    } catch {
      finalRecord = matchedFromHistory
        ? {
            ...matchedFromHistory,
            traceId: rootTrace.traceId,
            updatedAt: new Date().toISOString(),
          }
        : {
            transactionId: parsed.data.transactionId,
            customerId: "WPPES-CUST-9001",
            amount: 18500,
            currency: "USD",
            concept: "Transacción recuperada en simulación conectada (WPP Enterprise Solutions)",
            status: "APPROVED",
            riskLevel: "MEDIUM",
            traceId: rootTrace.traceId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
    }

    setQueriedHistory((prev) => [finalRecord, ...prev.slice(0, 9)]);
    setGetState({
      loading: false,
      errorMessage: null,
      response: finalRecord,
      rootTraceparent: rootTrace.raw,
      hops: stepDefinitions.map((h) => ({ ...h, status: "success" })),
      selectedHopIndex: 5,
      executedAt: new Date().toLocaleTimeString(),
    });
  }

  function renderInteractiveFlowDiagram(
    state: OperationExecutionState,
    setState: React.Dispatch<React.SetStateAction<OperationExecutionState>>,
    flowTitle: string
  ) {
    const selectedHop = state.hops[state.selectedHopIndex] || state.hops[0];
    const totalLatency = state.hops.reduce((acc, h) => acc + h.latencyMs, 0);

    return (
      <div
        style={{
          marginTop: "1.5rem",
          backgroundColor: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#f8fafc" }}>
              {flowTitle}
            </h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
              Haz clic en cualquier capa del diagrama para inspeccionar headers W3C{" "}
              <code>traceparent</code>, reglas de negocio o SQL ejecutado.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span
              style={{
                fontSize: "0.78rem",
                backgroundColor: "#1e293b",
                color: "#38bdf8",
                padding: "0.3rem 0.65rem",
                borderRadius: 999,
                border: "1px solid #334155",
              }}
            >
              Latencia Total Simulada: <strong>{totalLatency} ms</strong>
            </span>
          </div>
        </div>

        {/* Nodos del flujo por capas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
            gap: "0.65rem",
          }}
        >
          {state.hops.map((hop, idx) => {
            const isSelected = state.selectedHopIndex === idx;
            const borderColor =
              hop.status === "processing"
                ? "#f59e0b"
                : hop.status === "success"
                ? "#10b981"
                : "#334155";
            const bgColor = isSelected ? "#1e293b" : "#0b1120";

            return (
              <button
                key={hop.id}
                type="button"
                onClick={() =>
                  setState((prev) => ({ ...prev, selectedHopIndex: idx }))
                }
                style={{
                  textAlign: "left",
                  padding: "0.75rem",
                  borderRadius: 10,
                  backgroundColor: bgColor,
                  border: `2px solid ${isSelected ? "#38bdf8" : borderColor}`,
                  color: "#f8fafc",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.72rem",
                    color: "#94a3b8",
                    marginBottom: "0.3rem",
                  }}
                >
                  <span>{hop.layerCode}</span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor:
                        hop.status === "processing"
                          ? "#f59e0b"
                          : hop.status === "success"
                          ? "#10b981"
                          : "#475569",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    marginBottom: "0.25rem",
                    color: "#e2e8f0",
                  }}
                >
                  {hop.title}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "#38bdf8",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    marginBottom: "0.35rem",
                  }}
                >
                  {hop.awsResourceName}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.7rem",
                    color: "#64748b",
                  }}
                >
                  <span>span: {hop.spanId.slice(0, 8)}</span>
                  <span>{hop.latencyMs > 0 ? `${hop.latencyMs}ms` : "--"}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Inspector detallado del nodo seleccionado */}
        <div
          style={{
            marginTop: "1rem",
            backgroundColor: "#1e293b",
            borderRadius: 10,
            padding: "1rem",
            border: "1px solid #334155",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#38bdf8",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {selectedHop.layerCode} — {selectedHop.subnetOrZone}
              </span>
              <h4 style={{ margin: "0.2rem 0", fontSize: "0.95rem" }}>
                {selectedHop.artifactTitle}
              </h4>
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                fontFamily: "monospace",
                backgroundColor: "#0f172a",
                padding: "0.35rem 0.65rem",
                borderRadius: 6,
                color: "#a7f3d0",
                border: "1px solid #334155",
              }}
            >
              traceparent: {selectedHop.traceparent}
            </div>
          </div>
          <p style={{ margin: "0 0 0.65rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
            {selectedHop.summary}
          </p>
          <pre
            style={{
              margin: 0,
              backgroundColor: "#0b1120",
              padding: "0.85rem",
              borderRadius: 8,
              overflowX: "auto",
              fontSize: "0.8rem",
              color: "#38bdf8",
              border: "1px solid #1e293b",
            }}
          >
            {selectedHop.artifactContent}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 1140, margin: "0 auto", padding: "2rem 1.5rem 3.5rem" }}>
      {/* CABECERA CORPORATIVA WPP ENTERPRISE SOLUTIONS & VML */}
      <header
        style={{
          marginBottom: "1.75rem",
          padding: "1.5rem",
          borderRadius: 14,
          background:
            "linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)",
          border: "1px solid #334155",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1.25rem",
        }}
      >
        <div style={{ flex: "1 1 620px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <span
              style={{
                backgroundColor: "#0284c7",
                color: "#ffffff",
                padding: "0.25rem 0.75rem",
                borderRadius: 999,
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
              }}
            >
              WPP ENTERPRISE SOLUTIONS &amp; VML
            </span>
            <span
              style={{
                backgroundColor: "#0f172a",
                color: "#38bdf8",
                padding: "0.25rem 0.75rem",
                borderRadius: 999,
                fontSize: "0.78rem",
                fontWeight: 600,
                border: "1px solid #334155",
              }}
            >
              MACH + API-Led Connectivity (xAPI → pAPI → sAPI → RDS)
            </span>
          </div>
          <h1 style={{ fontSize: "1.85rem", marginTop: "0.75rem", marginBottom: "0.5rem" }}>
            AWS Cloud-Native &amp; Headless Reference Architecture
          </h1>
          <p
            style={{
              color: "#cbd5e1",
              margin: "0 0 0.5rem",
              fontSize: "0.93rem",
              lineHeight: 1.55,
            }}
          >
            <strong>Objetivo de la PoC:</strong> Demostrar en vivo las capacidades de ingeniería y
            transformación tecnológica de{" "}
            <a
              href="https://www.wpp.com/en/wpp-enterprise-solutions"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8", fontWeight: 600 }}
            >
              WPP Enterprise Solutions
            </a>{" "}
            y{" "}
            <a
              href="https://www.vml.com/expertise/enterprise-solutions"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8", fontWeight: 600 }}
            >
              VML
            </a>{" "}
            para diseñar, construir y operar plataformas digitales empresariales ágiles, seguras y
            escalables mediante la arquitectura <strong>MACH</strong> y{" "}
            <strong>API-Led Connectivity</strong> sobre{" "}
            <strong>Amazon Web Services (AWS)</strong> en la región de{" "}
            <strong>Querétaro, México (<code>mx-central-1</code>)</strong>.
          </p>
          <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            ¿Dudas con algún término técnico como{" "}
            <a href="#glosario-zod" style={{ color: "#38bdf8" }}>
              Zod
            </a>
            ,{" "}
            <a href="#glosario-traceparent" style={{ color: "#38bdf8" }}>
              W3C traceparent
            </a>{" "}
            o la{" "}
            <a href="#glosario-nomenclatura" style={{ color: "#38bdf8" }}>
              nomenclatura estándar wppes-*
            </a>
            ? Consulta el{" "}
            <a href="#glosario-tecnico" style={{ color: "#a7f3d0", fontWeight: 600 }}>
              Glosario Técnico al final de la página ↓
            </a>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a
              href="https://www.wpp.com/en/wpp-enterprise-solutions"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "0.55rem 0.9rem",
                borderRadius: 8,
                backgroundColor: "#f8fafc",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: "0.82rem",
                textDecoration: "none",
              }}
            >
              WPP Enterprise Solutions ↗
            </a>
            <a
              href="https://www.vml.com/expertise/enterprise-solutions"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "0.55rem 0.9rem",
                borderRadius: 8,
                backgroundColor: "#1e293b",
                color: "#38bdf8",
                border: "1px solid #38bdf8",
                fontWeight: 700,
                fontSize: "0.82rem",
                textDecoration: "none",
              }}
            >
              VML Enterprise Solutions ↗
            </a>
          </div>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
            Región AWS Primaria: <code>mx-central-1 (mxc1 - Querétaro, México)</code>
          </span>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* BREVE DESCRIPCIÓN Y ACORDEÓN DE 4 SECCIONES (INICIA CERRADO)          */}
      {/* ===================================================================== */}
      <section
        aria-label="Documentación Interactiva en Acordeón de la PoC"
        style={{
          marginBottom: "1.75rem",
          backgroundColor: "#1e293b",
          borderRadius: 12,
          border: "1px solid #334155",
          padding: "1.25rem 1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.9rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#f8fafc" }}>
              Documentación Ejecutiva y Arquitectónica de la PoC
            </h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              Los 4 paneles inician cerrados. Haz clic en cada fila para desplegar el contexto de
              negocio, el catálogo de servicios AWS o los diagramas de arquitectura.
            </p>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              backgroundColor: "#0f172a",
              color: "#a7f3d0",
              padding: "0.3rem 0.7rem",
              borderRadius: 999,
              border: "1px solid #065f46",
              fontFamily: "monospace",
            }}
          >
            Stack Activo: wppes-mach-poc-dev-mxc1-stack (CREATE_COMPLETE)
          </span>
        </div>

        <div style={{ display: "grid", gap: "0.65rem" }}>
          {/* PANEL 1 DEL ACORDEÓN: CAPACIDADES DE WPP ES & VML + EXPLICACIÓN DE LA POC */}
          <div
            style={{
              backgroundColor: "#0f172a",
              borderRadius: 10,
              border: openAccordions["poc-overview"]
                ? "1px solid #38bdf8"
                : "1px solid #334155",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              aria-expanded={openAccordions["poc-overview"]}
              onClick={() => toggleAccordion("poc-overview")}
              style={{
                width: "100%",
                padding: "0.9rem 1.1rem",
                backgroundColor: "transparent",
                border: "none",
                color: "#f8fafc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 700,
                fontSize: "0.92rem",
              }}
            >
              <span>
                1. Capacidades de WPP Enterprise Solutions &amp; VML y Explicación de la PoC MACH
              </span>
              <span
                style={{
                  color: "#38bdf8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  backgroundColor: "#1e293b",
                  padding: "0.2rem 0.65rem",
                  borderRadius: 6,
                  border: "1px solid #334155",
                }}
              >
                {openAccordions["poc-overview"] ? "▲ Cerrar" : "▼ Abrir"}
              </span>
            </button>

            {openAccordions["poc-overview"] && (
              <div
                style={{
                  padding: "0 1.1rem 1.1rem",
                  borderTop: "1px solid #1e293b",
                  fontSize: "0.87rem",
                  color: "#cbd5e1",
                  lineHeight: 1.6,
                }}
              >
                <p style={{ marginTop: "0.85rem" }}>
                  <strong>WPP Enterprise Solutions</strong> es la unidad operativa de
                  transformación empresarial de <strong>WPP</strong> que diseña, construye y opera
                  los sistemas de crecimiento en los que confían las empresas más competitivas del
                  mundo. A través de <strong>VML</strong>, integra a más de{" "}
                  <strong>12,000 especialistas en ingeniería, plataformas cloud, comercio
                  unificado, consultoría, CRM, CX e Inteligencia Artificial en más de 40
                  mercados</strong>, conectando la estrategia directamente con la ejecución
                  tecnológica junto a socios globales líderes como <strong>AWS</strong>.
                </p>
                <p style={{ marginTop: "0.5rem" }}>
                  El propósito de esta <strong>Prueba de Concepto (PoC)</strong> es demostrar de
                  forma tangible cómo <strong>WPP Enterprise Solutions y VML</strong> modernizan
                  ecosistemas legados mediante arquitecturas componibles <strong>MACH</strong> y{" "}
                  <strong>API-Led Connectivity</strong> sobre{" "}
                  <strong>Amazon Web Services (AWS)</strong> en la región{" "}
                  <strong>México (Centro) — Querétaro (<code>mx-central-1</code>)</strong>:
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "0.75rem",
                    marginTop: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      padding: "0.8rem",
                      borderRadius: 8,
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                    }}
                  >
                    <strong style={{ color: "#38bdf8" }}>M — Microservices</strong>
                    <p style={{ margin: "0.3rem 0 0", fontSize: "0.8rem" }}>
                      Servicios de negocio desacoplados en funciones AWS Lambda independientes por
                      capa (<code>xAPI</code>, <code>pAPI</code>, <code>sAPI</code>) que escalan y
                      evolucionan sin afectar al resto del ecosistema.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "0.8rem",
                      borderRadius: 8,
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                    }}
                  >
                    <strong style={{ color: "#2dd4bf" }}>A — API-First</strong>
                    <p style={{ margin: "0.3rem 0 0", fontSize: "0.8rem" }}>
                      Toda funcionalidad se expone mediante contratos claros (OpenAPI 3.1 y{" "}
                      <a href="#glosario-zod" style={{ color: "#38bdf8" }}>
                        esquemas Zod
                      </a>
                      ), permitiendo conectar canales web, móviles, B2B o puntos de venta sin
                      reescribir la lógica central.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "0.8rem",
                      borderRadius: 8,
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                    }}
                  >
                    <strong style={{ color: "#a7f3d0" }}>C — Cloud-Native</strong>
                    <p style={{ margin: "0.3rem 0 0", fontSize: "0.8rem" }}>
                      Infraestructura 100% Serverless y declarativa en{" "}
                      <a href="#glosario-cdk" style={{ color: "#38bdf8" }}>
                        AWS CDK v2
                      </a>{" "}
                      desplegada en Querétaro (<code>mx-central-1</code>) con seguridad{" "}
                      <a href="#glosario-oidc" style={{ color: "#38bdf8" }}>
                        OIDC sin llaves estáticas
                      </a>
                      .
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "0.8rem",
                      borderRadius: 8,
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                    }}
                  >
                    <strong style={{ color: "#e9d5ff" }}>H — Headless</strong>
                    <p style={{ margin: "0.3rem 0 0", fontSize: "0.8rem" }}>
                      La experiencia de usuario (Next.js en GitHub Pages) está totalmente separada
                      del backend y rastrea cada operación de extremo a extremo con{" "}
                      <a href="#glosario-traceparent" style={{ color: "#38bdf8" }}>
                        W3C Trace Context
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PANEL 2 DEL ACORDEÓN: SERVICIOS CLOUD, NOMENCLATURA ESTÁNDAR WPP Y COMANDOS */}
          <div
            style={{
              backgroundColor: "#0f172a",
              borderRadius: 10,
              border: openAccordions["aws-services"]
                ? "1px solid #38bdf8"
                : "1px solid #334155",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              aria-expanded={openAccordions["aws-services"]}
              onClick={() => toggleAccordion("aws-services")}
              style={{
                width: "100%",
                padding: "0.9rem 1.1rem",
                backgroundColor: "transparent",
                border: "none",
                color: "#f8fafc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 700,
                fontSize: "0.92rem",
              }}
            >
              <span>
                2. Servicios de AWS y GitHub, Nomenclatura Estándar WPP y Comandos de Despliegue
              </span>
              <span
                style={{
                  color: "#38bdf8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  backgroundColor: "#1e293b",
                  padding: "0.2rem 0.65rem",
                  borderRadius: 6,
                  border: "1px solid #334155",
                }}
              >
                {openAccordions["aws-services"] ? "▲ Cerrar" : "▼ Abrir"}
              </span>
            </button>

            {openAccordions["aws-services"] && (
              <div
                style={{
                  padding: "0.85rem 1.1rem 1.1rem",
                  borderTop: "1px solid #1e293b",
                  fontSize: "0.84rem",
                  color: "#cbd5e1",
                }}
              >
                <p style={{ margin: "0 0 0.75rem", color: "#94a3b8" }}>
                  Todos los recursos aprovisionados en AWS siguen el estándar de nomenclatura de{" "}
                  <strong>WPP Enterprise Solutions</strong>:{" "}
                  <code style={{ color: "#38bdf8" }}>
                    {"wppes-{workload}-{env}-{region_short}-{resource_type}-{component}"}
                  </code>{" "}
                  (ver desglose en el{" "}
                  <a href="#glosario-nomenclatura" style={{ color: "#38bdf8" }}>
                    Glosario
                  </a>
                  ).
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.8rem",
                      backgroundColor: "#0b1120",
                      borderRadius: 8,
                    }}
                  >
                    <thead>
                      <tr style={{ color: "#38bdf8", textAlign: "left" }}>
                        <th style={{ padding: "0.6rem", borderBottom: "1px solid #334155" }}>
                          Capa
                        </th>
                        <th style={{ padding: "0.6rem", borderBottom: "1px solid #334155" }}>
                          Servicio Cloud
                        </th>
                        <th style={{ padding: "0.6rem", borderBottom: "1px solid #334155" }}>
                          Identificador Estándar (mxc1)
                        </th>
                        <th style={{ padding: "0.6rem", borderBottom: "1px solid #334155" }}>
                          Ámbito
                        </th>
                        <th style={{ padding: "0.6rem", borderBottom: "1px solid #334155" }}>
                          Función en la Arquitectura
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {WPP_AWS_NAMING_CATALOG.map((item) => (
                        <tr
                          key={`acc-${item.resourceName}`}
                          style={{ borderBottom: "1px solid #1e293b" }}
                        >
                          <td style={{ padding: "0.55rem 0.6rem", fontWeight: 600 }}>
                            {item.layer}
                          </td>
                          <td style={{ padding: "0.55rem 0.6rem" }}>{item.service}</td>
                          <td
                            style={{
                              padding: "0.55rem 0.6rem",
                              fontFamily: "monospace",
                              color: "#a7f3d0",
                            }}
                          >
                            {item.resourceName}
                          </td>
                          <td style={{ padding: "0.55rem 0.6rem", color: "#94a3b8" }}>
                            {item.scope}
                          </td>
                          <td style={{ padding: "0.55rem 0.6rem", color: "#cbd5e1" }}>
                            {item.purpose}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    marginTop: "1rem",
                    backgroundColor: "#0b1120",
                    padding: "1rem",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                  }}
                >
                  <strong style={{ color: "#38bdf8", display: "block", marginBottom: "0.5rem" }}>
                    Comandos de Autenticación Sin Claves Estáticas y Despliegue CDK en Querétaro (
                    <code>mx-central-1</code>):
                  </strong>
                  <pre
                    style={{
                      margin: 0,
                      overflowX: "auto",
                      color: "#e2e8f0",
                      fontSize: "0.78rem",
                    }}
                  >{`# Opción A: Despliegue automatizado por GitHub Actions mediante Federación OIDC (Recomendado)
gh workflow run deploy-infra-cdk.yml --ref main
gh run list --workflow=deploy-infra-cdk.yml --limit 3

# Opción B: Ejecución desde terminal local con perfil SSO en Querétaro (mx-central-1)
aws configure sso --profile wppes-mach-poc-dev
aws sso login --profile wppes-mach-poc-dev
AWS_REGION=mx-central-1 npx cdk deploy WppesMachPocDevStack --profile wppes-mach-poc-dev`}</pre>
                </div>
              </div>
            )}
          </div>

          {/* PANEL 3 DEL ACORDEÓN: DIAGRAMA MERMAID API-LED CONNECTIVITY */}
          <div
            style={{
              backgroundColor: "#0f172a",
              borderRadius: 10,
              border: openAccordions["mermaid-api-led"]
                ? "1px solid #38bdf8"
                : "1px solid #334155",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              aria-expanded={openAccordions["mermaid-api-led"]}
              onClick={() => toggleAccordion("mermaid-api-led")}
              style={{
                width: "100%",
                padding: "0.9rem 1.1rem",
                backgroundColor: "transparent",
                border: "none",
                color: "#f8fafc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 700,
                fontSize: "0.92rem",
              }}
            >
              <span>
                3. Diagrama Mermaid — Arquitectura en modo API-Led Connectivity (xAPI → pAPI → sAPI)
              </span>
              <span
                style={{
                  color: "#38bdf8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  backgroundColor: "#1e293b",
                  padding: "0.2rem 0.65rem",
                  borderRadius: 6,
                  border: "1px solid #334155",
                }}
              >
                {openAccordions["mermaid-api-led"] ? "▲ Cerrar" : "▼ Abrir"}
              </span>
            </button>

            {openAccordions["mermaid-api-led"] && (
              <div
                style={{
                  padding: "0.85rem 1.1rem 1.1rem",
                  borderTop: "1px solid #1e293b",
                }}
              >
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.83rem", color: "#94a3b8" }}>
                  Desacoplamiento estricto en tres capas: <strong>Experience API</strong> (canal
                  web), <strong>Process API</strong> (orquestación y reglas antifraude) y{" "}
                  <strong>System API</strong> (único componente dentro de la VPC privada con acceso
                  al puerto <code>5432</code> de RDS PostgreSQL).
                </p>
                <MermaidDiagramView
                  chartId="mermaid-api-led-chart"
                  code={MERMAID_API_LED_CODE}
                />
              </div>
            )}
          </div>

          {/* PANEL 4 DEL ACORDEÓN: DIAGRAMA MERMAID END-TO-END DESDE GITHUB ACTIONS HASTA AWS RDS */}
          <div
            style={{
              backgroundColor: "#0f172a",
              borderRadius: 10,
              border: openAccordions["mermaid-e2e-cicd"]
                ? "1px solid #38bdf8"
                : "1px solid #334155",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              aria-expanded={openAccordions["mermaid-e2e-cicd"]}
              onClick={() => toggleAccordion("mermaid-e2e-cicd")}
              style={{
                width: "100%",
                padding: "0.9rem 1.1rem",
                backgroundColor: "transparent",
                border: "none",
                color: "#f8fafc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 700,
                fontSize: "0.92rem",
              }}
            >
              <span>
                4. Diagrama Mermaid — Interacción de extremo a extremo (GitHub Actions OIDC → AWS
                RDS PostgreSQL)
              </span>
              <span
                style={{
                  color: "#38bdf8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  backgroundColor: "#1e293b",
                  padding: "0.2rem 0.65rem",
                  borderRadius: 6,
                  border: "1px solid #334155",
                }}
              >
                {openAccordions["mermaid-e2e-cicd"] ? "▲ Cerrar" : "▼ Abrir"}
              </span>
            </button>

            {openAccordions["mermaid-e2e-cicd"] && (
              <div
                style={{
                  padding: "0.85rem 1.1rem 1.1rem",
                  borderTop: "1px solid #1e293b",
                }}
              >
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.83rem", color: "#94a3b8" }}>
                  Secuencia completa que muestra tanto el plano de control CI/CD (despliegue en{" "}
                  <strong>GitHub Pages</strong> y aprovisionamiento <strong>AWS CDK v2</strong> vía{" "}
                  <strong>OIDC</strong> en <code>mx-central-1</code>) como el plano de datos en
                  tiempo real hasta <strong>Amazon RDS PostgreSQL</strong>.
                </p>
                <MermaidDiagramView
                  chartId="mermaid-e2e-cicd-chart"
                  code={MERMAID_E2E_CICD_CODE}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* BARRA DE NAVEGACIÓN POR PESTAÑAS OPERATIVAS (SIN DUPLICAR LA TABLA DE SERVICIOS) */}
      <nav
        aria-label="Operaciones API-Led"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.65rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid #334155",
          paddingBottom: "0.85rem",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("post")}
          style={{
            padding: "0.7rem 1.2rem",
            borderRadius: 10,
            border: activeTab === "post" ? "2px solid #38bdf8" : "1px solid #334155",
            backgroundColor: activeTab === "post" ? "#0284c7" : "#1e293b",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          1. Registrar Transacción (POST xAPI)
          {postState.response && (
            <span
              style={{
                marginLeft: "0.5rem",
                backgroundColor: "#065f46",
                color: "#a7f3d0",
                padding: "0.1rem 0.45rem",
                borderRadius: 999,
                fontSize: "0.72rem",
              }}
            >
              Respuesta guardada
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("get")}
          style={{
            padding: "0.7rem 1.2rem",
            borderRadius: 10,
            border: activeTab === "get" ? "2px solid #2dd4bf" : "1px solid #334155",
            backgroundColor: activeTab === "get" ? "#0f766e" : "#1e293b",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          2. Consultar Estado (GET xAPI)
          {getState.response && (
            <span
              style={{
                marginLeft: "0.5rem",
                backgroundColor: "#065f46",
                color: "#a7f3d0",
                padding: "0.1rem 0.45rem",
                borderRadius: 999,
                fontSize: "0.72rem",
              }}
            >
              Respuesta guardada
            </span>
          )}
        </button>
      </nav>

      {/* ===================================================================== */}
      {/* PESTAÑA 1: FORMULARIO POST (CREAR TRANSACCIÓN) + RESPUESTA INDEPENDIENTE */}
      {/* ===================================================================== */}
      {activeTab === "post" && (
        <section
          style={{
            backgroundColor: "#1e293b",
            padding: "1.5rem",
            borderRadius: 12,
            border: "1px solid #334155",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {/* Columna Izquierda: Formulario POST */}
            <div>
              <h2 style={{ marginTop: 0, fontSize: "1.25rem", color: "#38bdf8" }}>
                Formulario 1: Creación de Transacción (POST /v1/transactions)
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 0 }}>
                Esta vista conserva su propia respuesta y traza distribuida aunque cambies a la
                pestaña de consulta GET.
              </p>

              <form
                onSubmit={handleCreateTransaction}
                style={{ display: "grid", gap: "0.85rem" }}
              >
                <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.88rem" }}>
                  Customer ID (Validado con Zod)
                  <input
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    style={{
                      padding: "0.6rem",
                      borderRadius: 6,
                      border: "1px solid #475569",
                      backgroundColor: "#0f172a",
                      color: "#f8fafc",
                    }}
                  />
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.88rem" }}>
                    Monto (&gt;10k MEDIUM, &gt;50k HIGH/PENDING)
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{
                        padding: "0.6rem",
                        borderRadius: 6,
                        border: "1px solid #475569",
                        backgroundColor: "#0f172a",
                        color: "#f8fafc",
                      }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.88rem" }}>
                    Moneda
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      style={{
                        padding: "0.6rem",
                        borderRadius: 6,
                        border: "1px solid #475569",
                        backgroundColor: "#0f172a",
                        color: "#f8fafc",
                      }}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="MXN">MXN</option>
                      <option value="COP">COP</option>
                      <option value="PEN">PEN</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.88rem" }}>
                  Concepto de Negocio
                  <input
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    style={{
                      padding: "0.6rem",
                      borderRadius: 6,
                      border: "1px solid #475569",
                      backgroundColor: "#0f172a",
                      color: "#f8fafc",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.88rem" }}>
                  Cognito Bearer JWT (wppes-mach-poc-dev-mxc1-cog-up)
                  <input
                    value={jwtToken}
                    onChange={(e) => setJwtToken(e.target.value)}
                    style={{
                      padding: "0.6rem",
                      borderRadius: 6,
                      border: "1px solid #475569",
                      backgroundColor: "#0f172a",
                      color: "#f8fafc",
                    }}
                  />
                </label>

                <button
                  type="submit"
                  disabled={postState.loading}
                  style={{
                    marginTop: "0.4rem",
                    padding: "0.8rem",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "#0284c7",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {postState.loading
                    ? "Recorriendo capas xAPI → pAPI → sAPI → RDS..."
                    : "Ejecutar POST y Trazar Capas hasta PostgreSQL"}
                </button>
              </form>

              {postState.errorMessage && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.85rem",
                    borderRadius: 8,
                    backgroundColor: "#7f1d1d",
                    color: "#fecaca",
                    fontSize: "0.85rem",
                  }}
                >
                  <strong>Error de Validación Zod (POST):</strong> {postState.errorMessage}
                </div>
              )}
            </div>

            {/* Columna Derecha: Respuesta exclusiva de POST */}
            <div
              style={{
                backgroundColor: "#0f172a",
                padding: "1.25rem",
                borderRadius: 10,
                border: "1px solid #334155",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#a7f3d0" }}>
                    Respuesta Exclusiva de POST (201 Created)
                  </h3>
                  {postState.executedAt && (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      Ejecutado a las {postState.executedAt}
                    </span>
                  )}
                </div>

                {postState.response ? (
                  <>
                    <pre
                      style={{
                        backgroundColor: "#0b1120",
                        padding: "0.9rem",
                        borderRadius: 8,
                        overflowX: "auto",
                        color: "#a7f3d0",
                        fontSize: "0.82rem",
                        border: "1px solid #1e293b",
                      }}
                    >
                      {JSON.stringify(postState.response, null, 2)}
                    </pre>
                    <div
                      style={{
                        marginTop: "0.75rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                        UUID generado: <code>{postState.response.transactionId}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQueryId(postState.response!.transactionId);
                          setActiveTab("get");
                        }}
                        style={{
                          padding: "0.45rem 0.8rem",
                          borderRadius: 6,
                          border: "1px solid #2dd4bf",
                          backgroundColor: "#0f766e",
                          color: "#ffffff",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Probar este UUID en Pestaña GET →
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      padding: "2rem 1rem",
                      textAlign: "center",
                      color: "#64748b",
                      fontSize: "0.88rem",
                      border: "1px dashed #334155",
                      borderRadius: 8,
                    }}
                  >
                    Aún no has enviado una transacción en esta pestaña. Presiona{" "}
                    <strong>&quot;Ejecutar POST y Trazar Capas&quot;</strong> para ver la respuesta
                    y el recorrido completo.
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid #1e293b",
                  fontSize: "0.78rem",
                  color: "#94a3b8",
                }}
              >
                <div>
                  W3C <code>traceparent</code> raíz (POST):
                </div>
                <code style={{ color: "#38bdf8", wordBreak: "break-all" }}>
                  {postState.rootTraceparent ||
                    "00-00000000000000000000000000000000-0000000000000000-01"}
                </code>
              </div>
            </div>
          </div>

          {/* Diagrama Interactivo del flujo POST */}
          {renderInteractiveFlowDiagram(
            postState,
            setPostState,
            "Recorrido en Vivo de Escritura (POST): SPA → API Gateway → xAPI → pAPI → sAPI → RDS PostgreSQL"
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 2: FORMULARIO GET (CONSULTAR ESTADO) + RESPUESTA INDEPENDIENTE */}
      {/* ===================================================================== */}
      {activeTab === "get" && (
        <section
          style={{
            backgroundColor: "#1e293b",
            padding: "1.5rem",
            borderRadius: 12,
            border: "1px solid #334155",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {/* Columna Izquierda: Formulario GET */}
            <div>
              <h2 style={{ marginTop: 0, fontSize: "1.25rem", color: "#2dd4bf" }}>
                {"Formulario 2: Consulta de Estado (GET /v1/transactions/{id})"}
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 0 }}>
                Consulta cualquier transacción por UUID sin sobrescribir ni borrar el resultado del
                formulario de creación (POST).
              </p>

              <form onSubmit={handleQueryStatus} style={{ display: "grid", gap: "0.85rem" }}>
                <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.88rem" }}>
                  Transaction UUID (Validado con QueryStatusSchema)
                  <input
                    placeholder="550e8400-e29b-41d4-a716-446655440000"
                    value={queryId}
                    onChange={(e) => setQueryId(e.target.value)}
                    style={{
                      padding: "0.6rem",
                      borderRadius: 6,
                      border: "1px solid #475569",
                      backgroundColor: "#0f172a",
                      color: "#f8fafc",
                    }}
                  />
                </label>

                {createdHistory.length > 0 && (
                  <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                    <div style={{ marginBottom: "0.35rem", color: "#94a3b8" }}>
                      Transacciones creadas en la Pestaña POST (clic para cargar UUID):
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {createdHistory.map((item) => (
                        <button
                          key={item.transactionId}
                          type="button"
                          onClick={() => setQueryId(item.transactionId)}
                          style={{
                            padding: "0.3rem 0.55rem",
                            fontSize: "0.74rem",
                            borderRadius: 6,
                            border: "1px solid #334155",
                            backgroundColor:
                              queryId === item.transactionId ? "#0f766e" : "#0f172a",
                            color: "#e2e8f0",
                            cursor: "pointer",
                            fontFamily: "monospace",
                          }}
                        >
                          {item.transactionId.slice(0, 8)}... ({item.amount} {item.currency})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={getState.loading}
                  style={{
                    marginTop: "0.4rem",
                    padding: "0.8rem",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "#0f766e",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {getState.loading
                    ? "Consultando capas xAPI → pAPI → sAPI → RDS..."
                    : "Ejecutar GET y Trazar Lectura hasta PostgreSQL"}
                </button>
              </form>

              {getState.errorMessage && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.85rem",
                    borderRadius: 8,
                    backgroundColor: "#7f1d1d",
                    color: "#fecaca",
                    fontSize: "0.85rem",
                  }}
                >
                  <strong>Error de Validación Zod (GET):</strong> {getState.errorMessage}
                </div>
              )}

              {queriedHistory.length > 1 && (
                <div style={{ marginTop: "1rem", fontSize: "0.78rem", color: "#94a3b8" }}>
                  Consultas recientes en esta sesión: <strong>{queriedHistory.length}</strong>
                </div>
              )}
            </div>

            {/* Columna Derecha: Respuesta exclusiva de GET */}
            <div
              style={{
                backgroundColor: "#0f172a",
                padding: "1.25rem",
                borderRadius: 10,
                border: "1px solid #334155",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#5eead4" }}>
                    Respuesta Exclusiva de GET (200 OK)
                  </h3>
                  {getState.executedAt && (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      Consultado a las {getState.executedAt}
                    </span>
                  )}
                </div>

                {getState.response ? (
                  <pre
                    style={{
                      backgroundColor: "#0b1120",
                      padding: "0.9rem",
                      borderRadius: 8,
                      overflowX: "auto",
                      color: "#5eead4",
                      fontSize: "0.82rem",
                      border: "1px solid #1e293b",
                    }}
                  >
                    {JSON.stringify(getState.response, null, 2)}
                  </pre>
                ) : (
                  <div
                    style={{
                      padding: "2rem 1rem",
                      textAlign: "center",
                      color: "#64748b",
                      fontSize: "0.88rem",
                      border: "1px dashed #334155",
                      borderRadius: 8,
                    }}
                  >
                    Aún no has ejecutado una consulta GET. Ingresa o selecciona un UUID y presiona{" "}
                    <strong>&quot;Ejecutar GET y Trazar Lectura&quot;</strong>.
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid #1e293b",
                  fontSize: "0.78rem",
                  color: "#94a3b8",
                }}
              >
                <div>
                  W3C <code>traceparent</code> raíz (GET):
                </div>
                <code style={{ color: "#2dd4bf", wordBreak: "break-all" }}>
                  {getState.rootTraceparent ||
                    "00-00000000000000000000000000000000-0000000000000000-01"}
                </code>
              </div>
            </div>
          </div>

          {/* Diagrama Interactivo del flujo GET */}
          {renderInteractiveFlowDiagram(
            getState,
            setGetState,
            "Recorrido en Vivo de Lectura (GET): SPA → API Gateway → xAPI → pAPI → sAPI → RDS PostgreSQL"
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* GLOSARIO DE TÉRMINOS TÉCNICOS Y ARQUITECTÓNICOS                       */}
      {/* ===================================================================== */}
      <section
        id="glosario-tecnico"
        aria-label="Glosario de Términos Técnicos y Arquitectónicos"
        style={{
          marginTop: "2.25rem",
          backgroundColor: "#1e293b",
          padding: "1.5rem",
          borderRadius: 12,
          border: "1px solid #334155",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#f8fafc" }}>
            Glosario de Términos Técnicos y Arquitectónicos
          </h2>
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
            Explicación clara de cada estándar, herramienta y convención utilizados en esta Prueba
            de Concepto de <strong>WPP Enterprise Solutions</strong> y <strong>VML</strong>.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
            gap: "0.9rem",
          }}
        >
          {/* 1. WPP Enterprise Solutions & VML */}
          <article
            id="glosario-wppes"
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.92rem" }}>
                WPP Enterprise Solutions &amp; VML
              </strong>
              <a
                href="https://www.vml.com/expertise/enterprise-solutions"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.75rem", color: "#a7f3d0" }}
              >
                Sitio oficial ↗
              </a>
            </div>
            <p
              style={{
                margin: "0.45rem 0 0",
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              Unidad operativa de transformación de negocios de <strong>WPP</strong> que, junto con{" "}
              <strong>VML</strong>, reúne a más de 12,000 especialistas en ingeniería, plataformas,
              comercio, CRM, CX e IA en más de 40 mercados para construir soluciones de crecimiento
              con socios como AWS.
            </p>
          </article>

          {/* 2. Arquitectura MACH */}
          <article
            id="glosario-mach"
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.92rem" }}>
                Arquitectura MACH
              </strong>
              <a
                href="https://machalliance.org/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.75rem", color: "#a7f3d0" }}
              >
                MACH Alliance ↗
              </a>
            </div>
            <p
              style={{
                margin: "0.45rem 0 0",
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              Estándar tecnológico compuesto por <strong>M</strong>icroservices (servicios
              independientes), <strong>A</strong>PI-First (todo expuesto por APIs),{" "}
              <strong>C</strong>loud-Native (nativo en la nube serverless) y <strong>H</strong>
              eadless (interfaz visual desacoplada del backend).
            </p>
          </article>

          {/* 3. API-Led Connectivity */}
          <article
            id="glosario-api-led"
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.92rem" }}>
                API-Led Connectivity (xAPI, pAPI, sAPI)
              </strong>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Patrón de 3 Capas</span>
            </div>
            <p
              style={{
                margin: "0.45rem 0 0",
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              Método que organiza las APIs en tres niveles: <strong>xAPI (Experience API)</strong>{" "}
              para atender el canal web/móvil; <strong>pAPI (Process API)</strong> para aplicar
              reglas de negocio y orquestación; y <strong>sAPI (System API)</strong> para hablar de
              forma segura con la base de datos.
            </p>
          </article>

          {/* 4. Zod */}
          <article
            id="glosario-zod"
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.92rem" }}>
                Zod (Contratos de Datos y Validación)
              </strong>
              <a
                href="https://zod.dev/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.75rem", color: "#a7f3d0" }}
              >
                zod.dev ↗
              </a>
            </div>
            <p
              style={{
                margin: "0.45rem 0 0",
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              Librería de validación para TypeScript que actúa como un &quot;contrato único&quot;
              entre el portal web y los microservicios. Garantiza que ningún dato incompleto,
              monto negativo o identificador mal formado llegue al backend o a la base de datos.
            </p>
          </article>

          {/* 5. W3C Trace Context / traceparent */}
          <article
            id="glosario-traceparent"
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.92rem" }}>
                W3C Trace Context (<code>traceparent</code>)
              </strong>
              <a
                href="https://www.w3.org/TR/trace-context/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.75rem", color: "#a7f3d0" }}
              >
                Estándar W3C ↗
              </a>
            </div>
            <p
              style={{
                margin: "0.45rem 0 0",
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              Estándar mundial del consorcio W3C para rastrear una operación a través de múltiples
              microservicios. Genera un encabezado{" "}
              <code>00-&#123;traceId&#125;-&#123;spanId&#125;-01</code> donde el{" "}
              <code>traceId</code> identifica toda la transacción de principio a fin y el{" "}
              <code>spanId</code> identifica el paso exacto en cada capa.
            </p>
          </article>

          {/* 6. Estándar de Nomenclatura wppes-mach-poc-dev-mxc1-* */}
          <article
            id="glosario-nomenclatura"
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.92rem" }}>
                Nomenclatura <code>wppes-mach-poc-dev-mxc1-*</code>
              </strong>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Gobernanza Cloud</span>
            </div>
            <p
              style={{
                margin: "0.45rem 0 0",
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              Convención empresarial para nombrar recursos en la nube de forma ordenada y auditable:
              <br />• <code>wppes</code>: WPP Enterprise Solutions
              <br />• <code>mach-poc</code>: Nombre del proyecto / carga de trabajo
              <br />• <code>dev</code>: Ambiente de desarrollo
              <br />• <code>mxc1</code>: Región AWS México Central — Querétaro (
              <code>mx-central-1</code>)
              <br />• <code>lmb / apigw / rds / sg</code>: Tipo de servicio AWS y componente.
            </p>
          </article>

          {/* 7. OpenID Connect (OIDC) */}
          <article
            id="glosario-oidc"
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.92rem" }}>
                Federación OIDC (Cero Claves Estáticas)
              </strong>
              <a
                href="https://docs.github.com/es/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.75rem", color: "#a7f3d0" }}
              >
                Guía OIDC ↗
              </a>
            </div>
            <p
              style={{
                margin: "0.45rem 0 0",
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              Mecanismo de seguridad DevSecOps mediante el cual GitHub Actions se autentica
              directamente con AWS usando tokens criptográficos efímeros, eliminando por completo el
              riesgo de guardar contraseñas o llaves secretas permanentes.
            </p>
          </article>

          {/* 8. AWS CDK v2 */}
          <article
            id="glosario-cdk"
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.92rem" }}>
                AWS CDK v2 (Infraestructura como Código)
              </strong>
              <a
                href="https://aws.amazon.com/es/cdk/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.75rem", color: "#a7f3d0" }}
              >
                AWS CDK ↗
              </a>
            </div>
            <p
              style={{
                margin: "0.45rem 0 0",
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              Framework de AWS que permite definir redes VPC, bases de datos PostgreSQL, API
              Gateways y funciones Lambda utilizando código TypeScript reproducible y auditable, en
              lugar de crearlos manualmente en la consola.
            </p>
          </article>
        </div>
      </section>

      {/* PIE DE PÁGINA CORPORATIVO CON ENLACES Y EXPLICACIONES */}
      <footer
        style={{
          marginTop: "2.5rem",
          paddingTop: "1.25rem",
          borderTop: "1px solid #1e293b",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
          fontSize: "0.8rem",
          color: "#94a3b8",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div>
            © 2026{" "}
            <a
              href="https://www.wpp.com/en/wpp-enterprise-solutions"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}
            >
              WPP Enterprise Solutions
            </a>{" "}
            &amp;{" "}
            <a
              href="https://www.vml.com/expertise/enterprise-solutions"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}
            >
              VML
            </a>{" "}
            — PoC MACH Architecture &amp; API-Led Connectivity on AWS (Querétaro, México).
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem" }}>
            <span>
              Estándar de Recursos:{" "}
              <a
                href="#glosario-nomenclatura"
                title="Ver explicación de la convención de nombres de recursos en el Glosario"
                style={{ color: "#a7f3d0", textDecoration: "underline", fontFamily: "monospace" }}
              >
                wppes-mach-poc-dev-mxc1-*
              </a>{" "}
              <span style={{ color: "#64748b" }}>
                (Prefijo corporativo en AWS Querétaro)
              </span>
            </span>
            <span>|</span>
            <span>
              Trazabilidad:{" "}
              <a
                href="https://www.w3.org/TR/trace-context/"
                target="_blank"
                rel="noopener noreferrer"
                title="Especificación oficial W3C Trace Context"
                style={{ color: "#38bdf8", textDecoration: "underline" }}
              >
                W3C Trace Context ↗
              </a>{" "}
              (
              <a href="#glosario-traceparent" style={{ color: "#cbd5e1" }}>
                ¿Qué es?
              </a>
              )
            </span>
            <span>|</span>
            <span>
              Contratos:{" "}
              <a
                href="https://zod.dev/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#38bdf8", textDecoration: "underline" }}
              >
                Zod ↗
              </a>{" "}
              (
              <a href="#glosario-zod" style={{ color: "#cbd5e1" }}>
                ¿Qué es?
              </a>
              )
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

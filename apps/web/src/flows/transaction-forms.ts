import {
  CreateTransactionSchema,
  QueryStatusSchema,
  TransactionResponse,
  TruncateTransactionsResponse,
  createTraceparent,
  Currency,
} from "@poc-mach/types";

export type HopStatus = "idle" | "processing" | "success" | "error";

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

export interface CreateTransactionFormInput {
  customerId: string;
  amountInput: string;
  currency: Currency;
  concept: string;
  jwtToken: string;
  baseUrl: string;
  existingHistory?: TransactionResponse[];
}

export interface CreateTransactionFormResult {
  ok: boolean;
  errorMessage: string | null;
  response: TransactionResponse | null;
  rootTraceparent: string | null;
  hops: LayerHopTrace[];
  updatedHistory: TransactionResponse[];
  source: "aws-live" | "local-fallback" | "validation-error";
}

export interface QueryTransactionFormInput {
  queryId: string;
  jwtToken: string;
  baseUrl: string;
  existingHistory?: TransactionResponse[];
}

export interface QueryTransactionFormResult {
  ok: boolean;
  errorMessage: string | null;
  response: TransactionResponse | null;
  rootTraceparent: string | null;
  hops: LayerHopTrace[];
  source: "aws-live" | "local-fallback" | "validation-error";
}

export interface TruncateTransactionsFlowInput {
  jwtToken: string;
  baseUrl: string;
}

export interface TruncateTransactionsFlowResult {
  ok: boolean;
  response: TruncateTransactionsResponse;
  rootTraceparent: string;
  source: "aws-live" | "local-fallback";
}

export type FormFieldHelpId =
  | "customerId"
  | "amount"
  | "currency"
  | "concept"
  | "jwtToken"
  | "queryId";

export const FORM_FIELD_TOOLTIPS: Record<
  FormFieldHelpId,
  { label: string; helpText: string }
> = {
  customerId: {
    label: "Customer ID",
    helpText:
      "Identificador único del cliente empresarial (3 a 64 caracteres), validado por CreateTransactionSchema en Zod.",
  },
  amount: {
    label: "Monto",
    helpText:
      "Importe de la transacción (> 0). En pAPI determina el riesgo: <= 10,000 LOW/APPROVED, > 10,000 MEDIUM/APPROVED y > 50,000 HIGH/PENDING.",
  },
  currency: {
    label: "Moneda",
    helpText:
      "Divisa ISO-4217 permitida por el contrato OpenAPI y Zod: USD, EUR, MXN, COP o PEN.",
  },
  concept: {
    label: "Concepto de Negocio",
    helpText:
      "Descripción comercial o motivo de la operación (3 a 255 caracteres) que se almacena en RDS PostgreSQL.",
  },
  jwtToken: {
    label: "Cognito Bearer JWT",
    helpText:
      "Token de autorización enviado en el header 'Authorization: Bearer <token>' hacia API Gateway v2 y validado en xAPI.",
  },
  queryId: {
    label: "Transaction UUID",
    helpText:
      "Identificador UUID v4 único generado al crear una transacción. Se valida con QueryStatusSchema antes de consultar sAPI y PostgreSQL.",
  },
};

export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export function generateUuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function classifyTransactionRisk(amount: number): {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  computedStatus: "APPROVED" | "PENDING";
} {
  if (amount > 50_000) {
    return { riskLevel: "HIGH", computedStatus: "PENDING" };
  }
  if (amount > 10_000) {
    return { riskLevel: "MEDIUM", computedStatus: "APPROVED" };
  }
  return { riskLevel: "LOW", computedStatus: "APPROVED" };
}

export function buildInitialHops(mode: "POST" | "GET"): LayerHopTrace[] {
  const isPost = mode === "POST";
  return [
    {
      id: "spa",
      layerCode: "1. Headless UI",
      title: "Next.js Static App",
      awsResourceName: "leninmeza-vml.github.io (apps/web)",
      subnetOrZone: "GitHub Pages CDN",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de envío...",
      latencyMs: 0,
      summary: isPost
        ? "Valida formulario con CreateTransactionSchema (Zod) y genera traceparent raíz."
        : "Valida UUID con QueryStatusSchema (Zod) y genera traceparent de consulta.",
      artifactTitle: "Payload de Entrada en Cliente Web",
      artifactContent: "// Ejecuta el formulario para inspeccionar el payload real.",
    },
    {
      id: "apigw",
      layerCode: "2. API Gateway + Cognito",
      title: "HTTP API v2 & JWT Auth",
      awsResourceName: "wppes-mach-poc-dev-mxc1-apigw-xapi",
      subnetOrZone: "AWS Edge (mx-central-1 Querétaro)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de envío...",
      latencyMs: 0,
      summary: "Verifica firma RS256 del token Bearer contra Cognito User Pool y aplica CORS.",
      artifactTitle: "Validación de Autorizador JWT y Enrutamiento HTTP",
      artifactContent: "// Esperando invocación hacia API Gateway v2...",
    },
    {
      id: "xapi",
      layerCode: "3. Experience API (xAPI)",
      title: "Lambda Experience Layer",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-xapi",
      subnetOrZone: "AWS Lambda (mx-central-1)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de envío...",
      latencyMs: 0,
      summary: "Adapta el contrato del canal web, extrae traceId y delega a pAPI.",
      artifactTitle: "Contrato de Entrada/Salida en Experience API",
      artifactContent: "// Esperando ejecución de wppes-mach-poc-dev-mxc1-lmb-xapi...",
    },
    {
      id: "papi",
      layerCode: "4. Process API (pAPI)",
      title: "Lambda Process Layer",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-papi",
      subnetOrZone: "AWS Lambda (mx-central-1)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de envío...",
      latencyMs: 0,
      summary: isPost
        ? "Evalúa reglas antifraude y límites (LOW / MEDIUM / HIGH) sin tocar la DB."
        : "Orquesta la consulta de estado de negocio hacia la capa de sistema.",
      artifactTitle: "Evaluación de Reglas de Negocio en Process API",
      artifactContent: "// Esperando ejecución de wppes-mach-poc-dev-mxc1-lmb-papi...",
    },
    {
      id: "sapi",
      layerCode: "5. System API (sAPI)",
      title: "Lambda System Layer",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-sapi",
      subnetOrZone: "VPC Subred Privada Aislada (mxc1)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de envío...",
      latencyMs: 0,
      summary: "Lee credenciales desde Secrets Manager y ejecuta SQL parametrizado con Drizzle/pg.",
      artifactTitle: "Comando de Sistema hacia Repositorio Transaccional",
      artifactContent: "// Esperando ejecución de wppes-mach-poc-dev-mxc1-lmb-sapi...",
    },
    {
      id: "rds",
      layerCode: "6. Amazon RDS PostgreSQL",
      title: "PostgreSQL 16 (Puerto 5432)",
      awsResourceName: "wppes-mach-poc-dev-mxc1-rds-pg",
      subnetOrZone: "VPC Isolated Subnet (SG 5432)",
      status: "idle",
      spanId: "----------------",
      traceparent: "Pendiente de envío...",
      latencyMs: 0,
      summary: isPost
        ? "Persiste registro ACID en tabla transactions y retorna fila confirmada."
        : "Ejecuta SELECT indexado por PK UUID sobre tabla transactions.",
      artifactTitle: "Sentencia SQL Parametrizada en PostgreSQL",
      artifactContent: "// Esperando confirmación de wppes-mach-poc-dev-mxc1-rds-pg...",
    },
  ];
}

export async function executeCreateTransactionFormFlow(
  input: CreateTransactionFormInput,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<CreateTransactionFormResult> {
  const existingHistory = input.existingHistory ?? [];
  const parsed = CreateTransactionSchema.safeParse({
    customerId: input.customerId.trim(),
    amount: Number(input.amountInput),
    currency: input.currency,
    concept: input.concept.trim(),
  });

  if (!parsed.success) {
    return {
      ok: false,
      errorMessage: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(" | "),
      response: null,
      rootTraceparent: null,
      hops: buildInitialHops("POST"),
      updatedHistory: existingHistory,
      source: "validation-error",
    };
  }

  const rootTrace = createTraceparent();
  const spanApigw = createTraceparent(rootTrace.traceId);
  const spanXapi = createTraceparent(rootTrace.traceId);
  const spanPapi = createTraceparent(rootTrace.traceId);
  const spanSapi = createTraceparent(rootTrace.traceId);
  const spanRds = createTraceparent(rootTrace.traceId);

  const { riskLevel, computedStatus } = classifyTransactionRisk(parsed.data.amount);
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
      summary: "Payload validado con CreateTransactionSchema (Zod) y traceparent W3C inyectado.",
      artifactTitle: "1. Petición HTTP Saliente desde Headless SPA (apps/web)",
      artifactContent: JSON.stringify(
        {
          method: "POST",
          url: `${input.baseUrl}/v1/transactions`,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.jwtToken.slice(0, 28)}...`,
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
      latencyMs: 11,
      summary: "CORS validado para https://leninmeza-vml.github.io y ruta POST /v1/transactions autorizada.",
      artifactTitle: "2. Contexto de Autorización en API Gateway v2",
      artifactContent: JSON.stringify(
        {
          apiGatewayName: "wppes-mach-poc-dev-mxc1-apigw-xapi",
          authorizer: "wppes-mach-poc-dev-mxc1-auth-cognito-jwt",
          userPool: "wppes-mach-poc-dev-mxc1-cog-up",
          routeKey: "POST /v1/transactions",
          corsOriginAllowed: "https://leninmeza-vml.github.io",
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
      latencyMs: 16,
      summary: "Adapta evento HTTP v2, genera child span y delega comando a pAPI.",
      artifactTitle: "3. Invocación desde xAPI hacia pAPI",
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
      title: "Lambda Process Layer",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-papi",
      subnetOrZone: "AWS Lambda (mx-central-1)",
      spanId: spanPapi.spanId,
      traceparent: spanPapi.raw,
      latencyMs: 19,
      summary: `Regla antifraude ejecutada: Monto ${parsed.data.amount} ${parsed.data.currency} -> Riesgo ${riskLevel} (${computedStatus}).`,
      artifactTitle: "4. Resultado de Orquestación y Reglas de Negocio en pAPI",
      artifactContent: JSON.stringify(
        {
          lambda: "wppes-mach-poc-dev-mxc1-lmb-papi",
          evaluatedRule:
            parsed.data.amount > 50_000
              ? "amount > 50000 => HIGH / PENDING"
              : parsed.data.amount > 10_000
                ? "amount > 10000 => MEDIUM / APPROVED"
                : "amount <= 10000 => LOW / APPROVED",
          decision: { riskLevel, status: computedStatus },
          nextHop: "wppes-mach-poc-dev-mxc1-lmb-sapi",
          traceparent: spanPapi.raw,
        },
        null,
        2
      ),
    },
    {
      id: "sapi",
      layerCode: "5. System API (sAPI)",
      title: "Lambda System Layer",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-sapi",
      subnetOrZone: "VPC Subred Privada Aislada (mxc1)",
      spanId: spanSapi.spanId,
      traceparent: spanSapi.raw,
      latencyMs: 24,
      summary: "Obtiene pool de conexión desde Secrets Manager y prepara INSERT parametrizado.",
      artifactTitle: "5. Ejecución en System API dentro de VPC Privada",
      artifactContent: JSON.stringify(
        {
          lambda: "wppes-mach-poc-dev-mxc1-lmb-sapi",
          vpc: "wppes-mach-poc-dev-mxc1-vpc",
          securityGroup: "wppes-mach-poc-dev-mxc1-sg-sapi-lambda",
          secretId: "wppes/mach-poc/dev/mxc1/rds-postgres-credentials",
          action: "PERSIST_TRANSACTION",
          traceId: rootTrace.traceId,
        },
        null,
        2
      ),
    },
    {
      id: "rds",
      layerCode: "6. Amazon RDS PostgreSQL",
      title: "PostgreSQL 16 (Puerto 5432)",
      awsResourceName: "wppes-mach-poc-dev-mxc1-rds-pg",
      subnetOrZone: "VPC Isolated Subnet (SG 5432)",
      spanId: spanRds.spanId,
      traceparent: spanRds.raw,
      latencyMs: 9,
      summary: "Transacción insertada en wppes_mach_poc.transactions con confirmación ACID.",
      artifactTitle: "6. Sentencia SQL Ejecutada en RDS PostgreSQL (Puerto 5432)",
      artifactContent: `INSERT INTO transactions (
  transaction_id, customer_id, amount, currency, concept,
  status, risk_level, trace_id, created_at, updated_at
) VALUES (
  '${generatedId}',
  '${parsed.data.customerId}',
  ${parsed.data.amount},
  '${parsed.data.currency}',
  '${parsed.data.concept.replaceAll("'", "''")}',
  '${computedStatus}',
  '${riskLevel}',
  '${rootTrace.traceId}',
  '${nowIso}',
  '${nowIso}'
) RETURNING *;`,
    },
  ];

  let finalRecord: TransactionResponse;
  let source: "aws-live" | "local-fallback" = "aws-live";

  try {
    const response = await fetchFn(`${input.baseUrl}/v1/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.jwtToken}`,
        traceparent: rootTrace.raw,
      },
      body: JSON.stringify(parsed.data),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    finalRecord = (await response.json()) as TransactionResponse;
  } catch {
    source = "local-fallback";
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

  return {
    ok: true,
    errorMessage: null,
    response: finalRecord,
    rootTraceparent: rootTrace.raw,
    hops: stepDefinitions.map((h) => ({ ...h, status: "success" })),
    updatedHistory: [finalRecord, ...existingHistory.slice(0, 9)],
    source,
  };
}

export async function executeQueryTransactionFormFlow(
  input: QueryTransactionFormInput,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<QueryTransactionFormResult> {
  const existingHistory = input.existingHistory ?? [];
  const parsed = QueryStatusSchema.safeParse({
    transactionId: input.queryId.trim(),
  });

  if (!parsed.success) {
    return {
      ok: false,
      errorMessage: parsed.error.issues.map((i) => i.message).join(" | "),
      response: null,
      rootTraceparent: null,
      hops: buildInitialHops("GET"),
      source: "validation-error",
    };
  }

  const rootTrace = createTraceparent();
  const spanApigw = createTraceparent(rootTrace.traceId);
  const spanXapi = createTraceparent(rootTrace.traceId);
  const spanPapi = createTraceparent(rootTrace.traceId);
  const spanSapi = createTraceparent(rootTrace.traceId);
  const spanRds = createTraceparent(rootTrace.traceId);

  const matchedFromHistory = existingHistory.find(
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
          url: `${input.baseUrl}/v1/transactions/${parsed.data.transactionId}`,
          headers: {
            Authorization: `Bearer ${input.jwtToken.slice(0, 28)}...`,
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
      title: "Lambda Process Layer",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-papi",
      subnetOrZone: "AWS Lambda (mx-central-1)",
      spanId: spanPapi.spanId,
      traceparent: spanPapi.raw,
      latencyMs: 12,
      summary: "Coordina lectura de estado transaccional hacia System API (sAPI).",
      artifactTitle: "4. Orquestación de Lectura en Process API",
      artifactContent: JSON.stringify(
        {
          lambda: "wppes-mach-poc-dev-mxc1-lmb-papi",
          actionRequested: "GET_TRANSACTION_BY_ID",
          targetLambda: "wppes-mach-poc-dev-mxc1-lmb-sapi",
          traceparent: spanPapi.raw,
        },
        null,
        2
      ),
    },
    {
      id: "sapi",
      layerCode: "5. System API (sAPI)",
      title: "Lambda System Layer",
      awsResourceName: "wppes-mach-poc-dev-mxc1-lmb-sapi",
      subnetOrZone: "VPC Subred Privada Aislada (mxc1)",
      spanId: spanSapi.spanId,
      traceparent: spanSapi.raw,
      latencyMs: 18,
      summary: "Ejecuta findById() sobre el pool de conexiones de PostgreSQL.",
      artifactTitle: "5. Consulta Parametrizada desde System API",
      artifactContent: JSON.stringify(
        {
          lambda: "wppes-mach-poc-dev-mxc1-lmb-sapi",
          vpcSecurityGroup: "wppes-mach-poc-dev-mxc1-sg-sapi-lambda",
          targetDbSecurityGroup: "wppes-mach-poc-dev-mxc1-sg-rds-postgres",
          port: 5432,
          transactionId: parsed.data.transactionId,
        },
        null,
        2
      ),
    },
    {
      id: "rds",
      layerCode: "6. Amazon RDS PostgreSQL",
      title: "PostgreSQL 16 (Puerto 5432)",
      awsResourceName: "wppes-mach-poc-dev-mxc1-rds-pg",
      subnetOrZone: "VPC Isolated Subnet (SG 5432)",
      spanId: spanRds.spanId,
      traceparent: spanRds.raw,
      latencyMs: 7,
      summary: "Retorna registro coincidente por índice primario UUID.",
      artifactTitle: "6. Sentencia SELECT Ejecutada en RDS PostgreSQL",
      artifactContent: `SELECT
  transaction_id AS "transactionId",
  customer_id AS "customerId",
  amount::float8 AS "amount",
  currency, concept, status,
  risk_level AS "riskLevel",
  trace_id AS "traceId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM transactions
WHERE transaction_id = '${parsed.data.transactionId}'
LIMIT 1;`,
    },
  ];

  let finalRecord: TransactionResponse;
  let source: "aws-live" | "local-fallback" = "aws-live";

  try {
    const response = await fetchFn(
      `${input.baseUrl}/v1/transactions/${parsed.data.transactionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${input.jwtToken}`,
          traceparent: rootTrace.raw,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    finalRecord = (await response.json()) as TransactionResponse;
  } catch {
    source = "local-fallback";
    const nowIso = new Date().toISOString();
    finalRecord = matchedFromHistory ?? {
      transactionId: parsed.data.transactionId,
      customerId: "CUST-WPPES-001",
      amount: 1250.5,
      currency: "USD",
      concept: "Consulta de estado verificada vía sAPI -> RDS PostgreSQL",
      status: "APPROVED",
      riskLevel: "LOW",
      traceId: rootTrace.traceId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  return {
    ok: true,
    errorMessage: null,
    response: finalRecord,
    rootTraceparent: rootTrace.raw,
    hops: stepDefinitions.map((h) => ({ ...h, status: "success" })),
    source,
  };
}

export async function executeTruncateTransactionsFlow(
  input: TruncateTransactionsFlowInput,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<TruncateTransactionsFlowResult> {
  const rootTrace = createTraceparent();
  let source: "aws-live" | "local-fallback" = "aws-live";
  let resultData: TruncateTransactionsResponse;

  try {
    const response = await fetchFn(`${input.baseUrl}/v1/transactions`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${input.jwtToken}`,
        traceparent: rootTrace.raw,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    resultData = (await response.json()) as TruncateTransactionsResponse;
  } catch {
    source = "local-fallback";
    resultData = {
      truncated: true,
      deletedCount: 0,
      message:
        "Base de datos de transacciones reiniciada en sesión local y memoria",
      traceId: rootTrace.traceId,
      executedAt: new Date().toISOString(),
    };
  }

  return {
    ok: true,
    response: resultData,
    rootTraceparent: rootTrace.raw,
    source,
  };
}

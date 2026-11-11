import {
  CreateTransactionSchema,
  QueryStatusSchema,
  createTraceparent,
  parseTraceparent,
} from "@poc-mach/types";
import {
  handler as papiHandler,
  PapiRequest,
  PapiResponse,
} from "@poc-mach/papi";

export interface ApiGatewayV2HttpEvent {
  requestContext: {
    http: {
      method: "GET" | "POST" | "OPTIONS";
      path: string;
    };
  };
  headers?: Record<string, string | undefined>;
  pathParameters?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  body?: string | null;
}

export interface ApiGatewayV2HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export type PapiInvoker = (req: PapiRequest) => Promise<PapiResponse>;

function logXapiEvent(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  details: Record<string, unknown>
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "wppes-mach-poc-dev-mxc1-lmb-xapi",
      layer: "xAPI",
      message,
      ...details,
    })
  );
}

export async function invokeRemotePapiLambda(
  functionName: string,
  request: PapiRequest,
  sdkLoader: () => {
    LambdaClient: new (cfg: Record<string, unknown>) => {
      send: (cmd: unknown) => Promise<{ Payload?: Uint8Array }>;
    };
    InvokeCommand: new (input: {
      FunctionName: string;
      Payload: Buffer;
    }) => unknown;
  } = () => require("@aws-sdk/client-lambda")
): Promise<PapiResponse> {
  const { LambdaClient, InvokeCommand } = sdkLoader();
  const client = new LambdaClient({});
  const response = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(request)),
    })
  );
  const rawPayload = response.Payload
    ? Buffer.from(response.Payload).toString("utf-8")
    : "{}";
  return JSON.parse(rawPayload) as PapiResponse;
}

const defaultPapiInvoker: PapiInvoker = async (request: PapiRequest) => {
  const remoteFn = process.env.PAPI_FUNCTION_NAME;
  if (remoteFn) {
    return invokeRemotePapiLambda(remoteFn, request);
  }
  return papiHandler(request);
};

export function validateBearerToken(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length >= 10;
}

export async function handler(
  event: ApiGatewayV2HttpEvent,
  papiInvokerOrLambdaContext?: PapiInvoker | Record<string, unknown>
): Promise<ApiGatewayV2HttpResponse> {
  const papiInvoker: PapiInvoker =
    typeof papiInvokerOrLambdaContext === "function"
      ? papiInvokerOrLambdaContext
      : defaultPapiInvoker;
  const normalizedHeaders: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    normalizedHeaders[k.toLowerCase()] = v;
  }

  const incomingTrace = parseTraceparent(normalizedHeaders["traceparent"]);
  const outboundTrace = createTraceparent(incomingTrace.traceId);

  const defaultHeaders: Record<string, string> = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type,Authorization,traceparent",
    "access-control-expose-headers": "traceparent",
    traceparent: outboundTrace.raw,
  };

  logXapiEvent("INFO", "Experience API (xAPI) recibió solicitud HTTP", {
    method: event.requestContext.http.method,
    path: event.requestContext.http.path,
    traceId: incomingTrace.traceId,
    spanId: outboundTrace.spanId,
    traceparent: outboundTrace.raw,
  });

  if (event.requestContext.http.method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: defaultHeaders,
      body: "",
    };
  }

  const authHeader = normalizedHeaders["authorization"];
  if (!validateBearerToken(authHeader)) {
    logXapiEvent("WARN", "Solicitud rechazada por token JWT Bearer ausente o inválido", {
      method: event.requestContext.http.method,
      path: event.requestContext.http.path,
      traceId: incomingTrace.traceId,
      traceparent: outboundTrace.raw,
      statusCode: 401,
    });
    return {
      statusCode: 401,
      headers: defaultHeaders,
      body: JSON.stringify({
        error: "Token JWT ausente o inválido en cabecera Authorization: Bearer",
        traceId: incomingTrace.traceId,
      }),
    };
  }

  try {
    if (event.requestContext.http.method === "POST") {
      const rawBody = event.body ? JSON.parse(event.body) : {};
      const parsed = CreateTransactionSchema.safeParse(rawBody);
      if (!parsed.success) {
        logXapiEvent("WARN", "Error de validación de contrato en POST xAPI", {
          traceId: incomingTrace.traceId,
          traceparent: outboundTrace.raw,
          statusCode: 400,
        });
        return {
          statusCode: 400,
          headers: defaultHeaders,
          body: JSON.stringify({
            error: "Error de validación de contrato en xAPI",
            issues: parsed.error.issues,
            traceId: incomingTrace.traceId,
          }),
        };
      }

      const papiResult = await papiInvoker({
        operation: "PROCESS_CREATE_TRANSACTION",
        traceparent: outboundTrace.raw,
        payload: parsed.data,
      });

      logXapiEvent("INFO", "Respuesta POST completada en xAPI", {
        statusCode: papiResult.statusCode,
        transactionId: papiResult.data?.transactionId,
        traceId: incomingTrace.traceId,
        traceparent: outboundTrace.raw,
      });

      return {
        statusCode: papiResult.statusCode,
        headers: defaultHeaders,
        body: JSON.stringify(
          papiResult.data ?? { error: papiResult.error, traceId: incomingTrace.traceId }
        ),
      };
    }

    if (event.requestContext.http.method === "GET") {
      const transactionId =
        event.pathParameters?.transactionId ??
        event.queryStringParameters?.transactionId ??
        "";
      const parsed = QueryStatusSchema.safeParse({ transactionId });
      if (!parsed.success) {
        logXapiEvent("WARN", "Identificador de transacción inválido en GET xAPI", {
          transactionId,
          traceId: incomingTrace.traceId,
          traceparent: outboundTrace.raw,
          statusCode: 400,
        });
        return {
          statusCode: 400,
          headers: defaultHeaders,
          body: JSON.stringify({
            error: "Identificador de transacción inválido",
            issues: parsed.error.issues,
            traceId: incomingTrace.traceId,
          }),
        };
      }

      const papiResult = await papiInvoker({
        operation: "PROCESS_QUERY_STATUS",
        traceparent: outboundTrace.raw,
        payload: parsed.data,
      });

      logXapiEvent("INFO", "Respuesta GET completada en xAPI", {
        statusCode: papiResult.statusCode,
        transactionId: parsed.data.transactionId,
        traceId: incomingTrace.traceId,
        traceparent: outboundTrace.raw,
      });

      return {
        statusCode: papiResult.statusCode,
        headers: defaultHeaders,
        body: JSON.stringify(
          papiResult.data ?? { error: papiResult.error, traceId: incomingTrace.traceId }
        ),
      };
    }

    return {
      statusCode: 405,
      headers: defaultHeaders,
      body: JSON.stringify({ error: "Método HTTP no permitido" }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado en xAPI";
    logXapiEvent("ERROR", "Error inesperado en Experience API (xAPI)", {
      error: message,
      traceId: incomingTrace.traceId,
      traceparent: outboundTrace.raw,
      statusCode: 500,
    });
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: JSON.stringify({
        error: message,
        traceId: incomingTrace.traceId,
      }),
    };
  }
}

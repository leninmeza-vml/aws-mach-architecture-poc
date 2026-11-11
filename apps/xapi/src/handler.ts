import {
  CreateTransactionSchema,
  QueryStatusSchema,
  createTraceparent,
  parseTraceparent,
} from "@poc-mach/types";
import { handler as papiHandler } from "@poc-mach/papi";

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

export function validateBearerToken(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length >= 10;
}

export async function handler(
  event: ApiGatewayV2HttpEvent
): Promise<ApiGatewayV2HttpResponse> {
  const normalizedHeaders: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    normalizedHeaders[k.toLowerCase()] = v;
  }

  const incomingTrace = parseTraceparent(normalizedHeaders["traceparent"]);
  const outboundTrace = createTraceparent(incomingTrace.traceId);

  const defaultHeaders: Record<string, string> = {
    "content-type": "application/json",
    traceparent: outboundTrace.raw,
  };

  if (event.requestContext.http.method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: defaultHeaders,
      body: "",
    };
  }

  const authHeader = normalizedHeaders["authorization"];
  if (!validateBearerToken(authHeader)) {
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

      const papiResult = await papiHandler({
        operation: "PROCESS_CREATE_TRANSACTION",
        traceparent: outboundTrace.raw,
        payload: parsed.data,
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

      const papiResult = await papiHandler({
        operation: "PROCESS_QUERY_STATUS",
        traceparent: outboundTrace.raw,
        payload: parsed.data,
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

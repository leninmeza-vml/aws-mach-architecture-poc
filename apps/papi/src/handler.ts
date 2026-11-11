import { randomUUID } from "node:crypto";
import {
  CreateTransactionInput,
  CreateTransactionSchema,
  QueryStatusSchema,
  RiskLevel,
  TransactionResponse,
  TruncateTransactionsResponse,
  TransactionStatus,
  createTraceparent,
  parseTraceparent,
} from "@poc-mach/types";
import {
  handler as sapiHandler,
  SapiCommand,
  SapiResult,
} from "@poc-mach/sapi";

export type PapiRequest =
  | {
      operation: "PROCESS_CREATE_TRANSACTION";
      traceparent?: string;
      payload: CreateTransactionInput;
    }
  | {
      operation: "PROCESS_QUERY_STATUS";
      traceparent?: string;
      payload: { transactionId: string };
    }
  | {
      operation: "PROCESS_TRUNCATE_TRANSACTIONS";
      traceparent?: string;
    };

export interface PapiResponse {
  statusCode: number;
  traceparent: string;
  data?: TransactionResponse;
  truncateData?: TruncateTransactionsResponse;
  error?: string;
}

export type SapiInvoker = (cmd: SapiCommand) => Promise<SapiResult>;

function logPapiEvent(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  details: Record<string, unknown>
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "wppes-mach-poc-dev-mxc1-lmb-papi",
      layer: "pAPI",
      message,
      ...details,
    })
  );
}

export async function invokeRemoteSapiLambda(
  functionName: string,
  command: SapiCommand,
  sdkLoader: () => {
    LambdaClient: new (cfg: Record<string, unknown>) => {
      send: (cmd: unknown) => Promise<{ Payload?: Uint8Array }>;
    };
    InvokeCommand: new (input: {
      FunctionName: string;
      Payload: Buffer;
    }) => unknown;
  } = () => require("@aws-sdk/client-lambda")
): Promise<SapiResult> {
  const { LambdaClient, InvokeCommand } = sdkLoader();
  const client = new LambdaClient({});
  const response = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(command)),
    })
  );
  const rawPayload = response.Payload
    ? Buffer.from(response.Payload).toString("utf-8")
    : "{}";
  return JSON.parse(rawPayload) as SapiResult;
}

const defaultSapiInvoker: SapiInvoker = async (command: SapiCommand) => {
  const remoteFn = process.env.SAPI_FUNCTION_NAME;
  if (remoteFn) {
    return invokeRemoteSapiLambda(remoteFn, command);
  }
  return sapiHandler(command);
};

export function evaluateBusinessRules(amount: number): {
  riskLevel: RiskLevel;
  status: TransactionStatus;
} {
  if (amount > 50_000) {
    return { riskLevel: "HIGH", status: "PENDING" };
  }
  if (amount > 10_000) {
    return { riskLevel: "MEDIUM", status: "APPROVED" };
  }
  return { riskLevel: "LOW", status: "APPROVED" };
}

export async function handler(
  event: PapiRequest,
  sapiInvokerOrLambdaContext?: SapiInvoker | Record<string, unknown>
): Promise<PapiResponse> {
  const sapiInvoker: SapiInvoker =
    typeof sapiInvokerOrLambdaContext === "function"
      ? sapiInvokerOrLambdaContext
      : defaultSapiInvoker;
  const incomingTrace = parseTraceparent(event.traceparent);
  const childTrace = createTraceparent(incomingTrace.traceId);

  logPapiEvent("INFO", "Process API (pAPI) invocada", {
    operation: event.operation,
    traceId: incomingTrace.traceId,
    spanId: childTrace.spanId,
    traceparent: childTrace.raw,
  });

  if (event.operation === "PROCESS_CREATE_TRANSACTION") {
    const validated = CreateTransactionSchema.parse(event.payload);
    const { riskLevel, status } = evaluateBusinessRules(validated.amount);

    logPapiEvent("INFO", "Reglas de negocio y antifraude evaluadas en pAPI", {
      operation: event.operation,
      customerId: validated.customerId,
      amount: validated.amount,
      currency: validated.currency,
      riskLevel,
      status,
      traceId: incomingTrace.traceId,
      traceparent: childTrace.raw,
    });

    const sapiResult = await sapiInvoker({
      action: "PERSIST_TRANSACTION",
      traceparent: childTrace.raw,
      payload: {
        transactionId: randomUUID(),
        customerId: validated.customerId,
        amount: validated.amount,
        currency: validated.currency,
        concept: validated.concept,
        status,
        riskLevel,
        traceId: incomingTrace.traceId,
      },
    });

    logPapiEvent("INFO", "Respuesta recibida desde sAPI en pAPI", {
      operation: event.operation,
      statusCode: sapiResult.statusCode,
      traceId: incomingTrace.traceId,
      traceparent: childTrace.raw,
    });

    return {
      statusCode: sapiResult.statusCode,
      traceparent: childTrace.raw,
      data: sapiResult.data,
      error: sapiResult.error,
    };
  }

  if (event.operation === "PROCESS_QUERY_STATUS") {
    const validated = QueryStatusSchema.parse(event.payload);
    const sapiResult = await sapiInvoker({
      action: "GET_TRANSACTION_BY_ID",
      traceparent: childTrace.raw,
      payload: { transactionId: validated.transactionId },
    });

    logPapiEvent("INFO", "Consulta de estado completada en pAPI", {
      operation: event.operation,
      transactionId: validated.transactionId,
      statusCode: sapiResult.statusCode,
      traceId: incomingTrace.traceId,
      traceparent: childTrace.raw,
    });

    return {
      statusCode: sapiResult.statusCode,
      traceparent: childTrace.raw,
      data: sapiResult.data,
      error: sapiResult.error,
    };
  }

  if (event.operation === "PROCESS_TRUNCATE_TRANSACTIONS") {
    const sapiResult = await sapiInvoker({
      action: "TRUNCATE_TRANSACTIONS",
      traceparent: childTrace.raw,
    });

    logPapiEvent("INFO", "Truncado de transacciones completado en pAPI", {
      operation: event.operation,
      deletedCount: sapiResult.truncateData?.deletedCount,
      statusCode: sapiResult.statusCode,
      traceId: incomingTrace.traceId,
      traceparent: childTrace.raw,
    });

    return {
      statusCode: sapiResult.statusCode,
      traceparent: childTrace.raw,
      truncateData: sapiResult.truncateData,
      error: sapiResult.error,
    };
  }

  logPapiEvent("WARN", "Operación no reconocida en pAPI", {
    traceId: incomingTrace.traceId,
    traceparent: childTrace.raw,
    statusCode: 400,
  });

  return {
    statusCode: 400,
    traceparent: childTrace.raw,
    error: "Operación no reconocida en pAPI",
  };
}

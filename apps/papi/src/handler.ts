import { randomUUID } from "node:crypto";
import {
  CreateTransactionInput,
  CreateTransactionSchema,
  QueryStatusSchema,
  RiskLevel,
  TransactionResponse,
  TransactionStatus,
  createTraceparent,
  parseTraceparent,
} from "@poc-mach/types";
import { handler as sapiHandler } from "@poc-mach/sapi";

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
    };

export interface PapiResponse {
  statusCode: number;
  traceparent: string;
  data?: TransactionResponse;
  error?: string;
}

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

export async function handler(event: PapiRequest): Promise<PapiResponse> {
  const incomingTrace = parseTraceparent(event.traceparent);
  const childTrace = createTraceparent(incomingTrace.traceId);

  if (event.operation === "PROCESS_CREATE_TRANSACTION") {
    const validated = CreateTransactionSchema.parse(event.payload);
    const { riskLevel, status } = evaluateBusinessRules(validated.amount);

    const sapiResult = await sapiHandler({
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

    return {
      statusCode: sapiResult.statusCode,
      traceparent: childTrace.raw,
      data: sapiResult.data,
      error: sapiResult.error,
    };
  }

  if (event.operation === "PROCESS_QUERY_STATUS") {
    const validated = QueryStatusSchema.parse(event.payload);
    const sapiResult = await sapiHandler({
      action: "GET_TRANSACTION_BY_ID",
      traceparent: childTrace.raw,
      payload: { transactionId: validated.transactionId },
    });

    return {
      statusCode: sapiResult.statusCode,
      traceparent: childTrace.raw,
      data: sapiResult.data,
      error: sapiResult.error,
    };
  }

  return {
    statusCode: 400,
    traceparent: childTrace.raw,
    error: "Operación no reconocida en pAPI",
  };
}

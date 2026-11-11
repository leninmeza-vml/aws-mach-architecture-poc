import {
  PersistTransactionParams,
  TransactionRepository,
} from "@poc-mach/database";
import {
  QueryStatusSchema,
  TransactionResponse,
  parseTraceparent,
} from "@poc-mach/types";

export type SapiCommand =
  | {
      action: "PERSIST_TRANSACTION";
      traceparent?: string;
      payload: PersistTransactionParams;
    }
  | {
      action: "GET_TRANSACTION_BY_ID";
      traceparent?: string;
      payload: { transactionId: string };
    };

export interface SapiResult {
  statusCode: number;
  traceId: string;
  data?: TransactionResponse;
  error?: string;
}

const repository = new TransactionRepository();

export async function handler(event: SapiCommand): Promise<SapiResult> {
  const trace = parseTraceparent(event.traceparent);

  try {
    if (event.action === "PERSIST_TRANSACTION") {
      const record = await repository.insertTransaction({
        ...event.payload,
        traceId: trace.traceId,
      });
      return {
        statusCode: 201,
        traceId: trace.traceId,
        data: record,
      };
    }

    if (event.action === "GET_TRANSACTION_BY_ID") {
      const parsed = QueryStatusSchema.parse(event.payload);
      const record = await repository.findById(parsed.transactionId);
      if (!record) {
        return {
          statusCode: 404,
          traceId: trace.traceId,
          error: `Transacción ${parsed.transactionId} no encontrada en System API`,
        };
      }
      return {
        statusCode: 200,
        traceId: trace.traceId,
        data: record,
      };
    }

    return {
      statusCode: 400,
      traceId: trace.traceId,
      error: "Acción no soportada por sAPI",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno en sAPI";
    return {
      statusCode: 500,
      traceId: trace.traceId,
      error: message,
    };
  }
}

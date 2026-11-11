import {
  PersistTransactionParams,
  TransactionRepository,
} from "@poc-mach/database";
import {
  QueryStatusSchema,
  TransactionResponse,
  TruncateTransactionsResponse,
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
    }
  | {
      action: "TRUNCATE_TRANSACTIONS";
      traceparent?: string;
    };

export interface SapiResult {
  statusCode: number;
  traceId: string;
  data?: TransactionResponse;
  truncateData?: TruncateTransactionsResponse;
  error?: string;
}

const defaultRepository = new TransactionRepository();

function logSapiEvent(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  details: Record<string, unknown>
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "wppes-mach-poc-dev-mxc1-lmb-sapi",
      layer: "sAPI",
      message,
      ...details,
    })
  );
}

export async function handler(
  event: SapiCommand,
  repoOrLambdaContext?: TransactionRepository | Record<string, unknown>
): Promise<SapiResult> {
  const repo: TransactionRepository =
    repoOrLambdaContext &&
    typeof (repoOrLambdaContext as TransactionRepository).insertTransaction ===
      "function"
      ? (repoOrLambdaContext as TransactionRepository)
      : defaultRepository;
  const trace = parseTraceparent(event.traceparent);

  logSapiEvent("INFO", "System API (sAPI) invocada", {
    action: event.action,
    traceId: trace.traceId,
    spanId: trace.spanId,
    traceparent: trace.raw,
  });

  try {
    if (event.action === "PERSIST_TRANSACTION") {
      const record = await repo.insertTransaction({
        ...event.payload,
        traceId: trace.traceId,
      });
      logSapiEvent("INFO", "Transacción persistida en capa de datos por sAPI", {
        action: event.action,
        transactionId: record.transactionId,
        status: record.status,
        riskLevel: record.riskLevel,
        traceId: trace.traceId,
        traceparent: trace.raw,
        statusCode: 201,
      });
      return {
        statusCode: 201,
        traceId: trace.traceId,
        data: record,
      };
    }

    if (event.action === "GET_TRANSACTION_BY_ID") {
      const parsed = QueryStatusSchema.parse(event.payload);
      const record = await repo.findById(parsed.transactionId);
      if (!record) {
        logSapiEvent("WARN", "Transacción no encontrada en System API", {
          action: event.action,
          transactionId: parsed.transactionId,
          traceId: trace.traceId,
          traceparent: trace.raw,
          statusCode: 404,
        });
        return {
          statusCode: 404,
          traceId: trace.traceId,
          error: `Transacción ${parsed.transactionId} no encontrada en System API`,
        };
      }
      logSapiEvent("INFO", "Transacción recuperada exitosamente por sAPI", {
        action: event.action,
        transactionId: record.transactionId,
        status: record.status,
        traceId: trace.traceId,
        traceparent: trace.raw,
        statusCode: 200,
      });
      return {
        statusCode: 200,
        traceId: trace.traceId,
        data: record,
      };
    }

    if (event.action === "TRUNCATE_TRANSACTIONS") {
      const truncateResult = await repo.truncateTransactions(trace.traceId);
      logSapiEvent("INFO", "Tabla transactions limpiada/truncada por sAPI", {
        action: event.action,
        deletedCount: truncateResult.deletedCount,
        traceId: trace.traceId,
        traceparent: trace.raw,
        statusCode: 200,
      });
      return {
        statusCode: 200,
        traceId: trace.traceId,
        truncateData: truncateResult,
      };
    }

    logSapiEvent("WARN", "Acción no soportada por sAPI", {
      traceId: trace.traceId,
      traceparent: trace.raw,
      statusCode: 400,
    });
    return {
      statusCode: 400,
      traceId: trace.traceId,
      error: "Acción no soportada por sAPI",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno en sAPI";
    logSapiEvent("ERROR", "Fallo en ejecución de System API (sAPI)", {
      error: message,
      traceId: trace.traceId,
      traceparent: trace.raw,
      statusCode: 500,
    });
    return {
      statusCode: 500,
      traceId: trace.traceId,
      error: message,
    };
  }
}

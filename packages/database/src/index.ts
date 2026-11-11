import { Pool, PoolConfig } from "pg";
import {
  TransactionResponse,
  TransactionResponseSchema,
  TruncateTransactionsResponse,
  TruncateTransactionsResponseSchema,
  Currency,
  TransactionStatus,
  RiskLevel,
} from "@poc-mach/types";

export { transactionsTable } from "./schema";

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

export interface QueryExecutor {
  query(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: unknown[]; rowCount: number | null }>;
}

let sharedPool: Pool | null = null;

export function resetDatabasePool(): void {
  sharedPool = null;
}

export function getDatabasePool(config?: DatabaseConnectionConfig): Pool {
  if (!sharedPool) {
    let poolConfig: PoolConfig;
    if (config) {
      poolConfig = {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      };
    } else if (process.env.DB_HOST) {
      poolConfig = {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? "5432"),
        database: process.env.DB_NAME ?? "wppes_mach_poc",
        user: process.env.DB_USER ?? "wppes_mach_admin",
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      };
    } else {
      poolConfig = {
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      };
    }
    sharedPool = new Pool(poolConfig);
  }
  return sharedPool;
}

export interface PersistTransactionParams {
  transactionId: string;
  customerId: string;
  amount: number;
  currency: Currency;
  concept: string;
  status: TransactionStatus;
  riskLevel: RiskLevel;
  traceId: string;
}

const inMemoryStore = new Map<string, TransactionResponse>();

export const ENSURE_TRANSACTIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS transactions (
    transaction_id UUID PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    concept VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    risk_level VARCHAR(16) NOT NULL,
    trace_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

export class TransactionRepository {
  private schemaInitialized = false;

  constructor(
    private readonly useInMemoryFallback = !process.env.DATABASE_URL &&
      !process.env.DB_HOST,
    private readonly customExecutor?: QueryExecutor
  ) {}

  private getExecutor(): QueryExecutor {
    return this.customExecutor ?? getDatabasePool();
  }

  private async ensureSchema(executor: QueryExecutor): Promise<void> {
    if (!this.schemaInitialized) {
      await executor.query(ENSURE_TRANSACTIONS_TABLE_SQL);
      this.schemaInitialized = true;
    }
  }

  async insertTransaction(
    params: PersistTransactionParams
  ): Promise<TransactionResponse> {
    const now = new Date().toISOString();

    if (this.useInMemoryFallback && !this.customExecutor) {
      const record: TransactionResponse = TransactionResponseSchema.parse({
        ...params,
        createdAt: now,
        updatedAt: now,
      });
      inMemoryStore.set(record.transactionId, record);
      return record;
    }

    const executor = this.getExecutor();
    await this.ensureSchema(executor);

    const query = `
      INSERT INTO transactions (
        transaction_id, customer_id, amount, currency, concept, status, risk_level, trace_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        transaction_id AS "transactionId",
        customer_id AS "customerId",
        amount::float8 AS "amount",
        currency,
        concept,
        status,
        risk_level AS "riskLevel",
        trace_id AS "traceId",
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
        to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
    `;
    const result = await executor.query(query, [
      params.transactionId,
      params.customerId,
      params.amount,
      params.currency,
      params.concept,
      params.status,
      params.riskLevel,
      params.traceId,
      now,
      now,
    ]);
    return TransactionResponseSchema.parse(result.rows[0]);
  }

  async findById(transactionId: string): Promise<TransactionResponse | null> {
    if (this.useInMemoryFallback && !this.customExecutor) {
      return inMemoryStore.get(transactionId) ?? null;
    }

    const executor = this.getExecutor();
    await this.ensureSchema(executor);

    const query = `
      SELECT
        transaction_id AS "transactionId",
        customer_id AS "customerId",
        amount::float8 AS "amount",
        currency,
        concept,
        status,
        risk_level AS "riskLevel",
        trace_id AS "traceId",
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
        to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
      FROM transactions
      WHERE transaction_id = $1
      LIMIT 1
    `;
    const result = await executor.query(query, [transactionId]);
    if (result.rowCount === 0) {
      return null;
    }
    return TransactionResponseSchema.parse(result.rows[0]);
  }

  async truncateTransactions(
    traceId: string
  ): Promise<TruncateTransactionsResponse> {
    const executedAt = new Date().toISOString();

    if (this.useInMemoryFallback && !this.customExecutor) {
      const deletedCount = inMemoryStore.size;
      inMemoryStore.clear();
      return TruncateTransactionsResponseSchema.parse({
        truncated: true,
        deletedCount,
        message: `Tabla de transacciones limpiada (${deletedCount} registros eliminados en memoria)`,
        traceId,
        executedAt,
      });
    }

    const executor = this.getExecutor();
    await this.ensureSchema(executor);

    const countResult = await executor.query(
      "SELECT COUNT(*)::int AS count FROM transactions"
    );
    const firstRow = (countResult.rows[0] ?? {}) as { count?: number };
    const deletedCount = Number(firstRow.count ?? 0);

    await executor.query("TRUNCATE TABLE transactions");

    return TruncateTransactionsResponseSchema.parse({
      truncated: true,
      deletedCount,
      message: `Tabla transactions truncada exitosamente en RDS PostgreSQL (${deletedCount} registros eliminados)`,
      traceId,
      executedAt,
    });
  }
}

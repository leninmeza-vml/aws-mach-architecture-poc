import { Pool, PoolConfig } from "pg";
import {
  TransactionResponse,
  TransactionResponseSchema,
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

let sharedPool: Pool | null = null;

export function getDatabasePool(config?: DatabaseConnectionConfig): Pool {
  if (!sharedPool) {
    const poolConfig: PoolConfig = config
      ? {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl ? { rejectUnauthorized: true } : false,
          max: 5,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        }
      : {
          connectionString: process.env.DATABASE_URL,
          max: 5,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        };
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

export class TransactionRepository {
  constructor(private readonly useInMemoryFallback = !process.env.DATABASE_URL) {}

  async insertTransaction(
    params: PersistTransactionParams
  ): Promise<TransactionResponse> {
    const now = new Date().toISOString();

    if (this.useInMemoryFallback) {
      const record: TransactionResponse = TransactionResponseSchema.parse({
        ...params,
        createdAt: now,
        updatedAt: now,
      });
      inMemoryStore.set(record.transactionId, record);
      return record;
    }

    const pool = getDatabasePool();
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
    const result = await pool.query(query, [
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
    if (this.useInMemoryFallback) {
      return inMemoryStore.get(transactionId) ?? null;
    }

    const pool = getDatabasePool();
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
    const result = await pool.query(query, [transactionId]);
    if (result.rowCount === 0) {
      return null;
    }
    return TransactionResponseSchema.parse(result.rows[0]);
  }
}

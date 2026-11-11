import { z } from "zod";

export const CurrencyEnum = z.enum(["USD", "EUR", "MXN", "COP", "PEN"]);
export type Currency = z.infer<typeof CurrencyEnum>;

export const TransactionStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "FAILED",
]);
export type TransactionStatus = z.infer<typeof TransactionStatusEnum>;

export const RiskLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type RiskLevel = z.infer<typeof RiskLevelEnum>;

export const CreateTransactionSchema = z.object({
  customerId: z
    .string()
    .min(3, "El customerId debe tener al menos 3 caracteres")
    .max(64),
  amount: z
    .number()
    .positive("El monto debe ser mayor que cero")
    .max(1_000_000, "El monto excede el límite permitido"),
  currency: CurrencyEnum.default("USD"),
  concept: z
    .string()
    .min(3, "El concepto debe tener al menos 3 caracteres")
    .max(255),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

export const TransactionResponseSchema = z.object({
  transactionId: z.string().uuid(),
  customerId: z.string(),
  amount: z.number(),
  currency: CurrencyEnum,
  concept: z.string(),
  status: TransactionStatusEnum,
  riskLevel: RiskLevelEnum,
  traceId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;

export const QueryStatusSchema = z.object({
  transactionId: z.string().uuid("El transactionId debe ser un UUID válido"),
});
export type QueryStatusInput = z.infer<typeof QueryStatusSchema>;

export const TruncateTransactionsResponseSchema = z.object({
  truncated: z.boolean(),
  deletedCount: z.number().int().nonnegative(),
  message: z.string(),
  traceId: z.string(),
  executedAt: z.string().datetime(),
});
export type TruncateTransactionsResponse = z.infer<
  typeof TruncateTransactionsResponseSchema
>;

export const W3C_TRACEPARENT_REGEX =
  /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceContext {
  version: "00";
  traceId: string;
  spanId: string;
  traceFlags: string;
  raw: string;
}

function randomHex(length: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

export function createTraceparent(existingTraceId?: string): TraceContext {
  const traceId =
    existingTraceId && /^[0-9a-f]{32}$/.test(existingTraceId)
      ? existingTraceId
      : randomHex(32);
  const spanId = randomHex(16);
  const traceFlags = "01";
  return {
    version: "00",
    traceId,
    spanId,
    traceFlags,
    raw: `00-${traceId}-${spanId}-${traceFlags}`,
  };
}

export function parseTraceparent(header?: string | null): TraceContext {
  if (header) {
    const match = W3C_TRACEPARENT_REGEX.exec(header.trim().toLowerCase());
    if (match) {
      return {
        version: "00",
        traceId: match[1],
        spanId: match[2],
        traceFlags: match[3],
        raw: `00-${match[1]}-${match[2]}-${match[3]}`,
      };
    }
  }
  return createTraceparent();
}

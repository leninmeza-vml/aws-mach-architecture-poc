import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CreateTransactionSchema,
  QueryStatusSchema,
  TruncateTransactionsResponseSchema,
  createTraceparent,
  parseTraceparent,
} from "./index";

describe("@poc-mach/types contracts", () => {
  it("valida correctamente un payload de CreateTransactionSchema y TruncateTransactionsResponseSchema", () => {
    const parsed = CreateTransactionSchema.parse({
      customerId: "CUST-9001",
      amount: 450.75,
      currency: "USD",
      concept: "Suscripción anual Cloud MACH",
    });
    assert.equal(parsed.customerId, "CUST-9001");
    assert.equal(parsed.currency, "USD");

    const truncated = TruncateTransactionsResponseSchema.parse({
      truncated: true,
      deletedCount: 5,
      message: "Tabla transactions truncada exitosamente",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      executedAt: new Date().toISOString(),
    });
    assert.equal(truncated.truncated, true);
    assert.equal(truncated.deletedCount, 5);
  });

  it("genera y parsea un header W3C traceparent válido y propaga traceId existente", () => {
    const trace = createTraceparent();
    const childTrace = createTraceparent(trace.traceId);
    assert.equal(childTrace.traceId, trace.traceId);

    const parsed = parseTraceparent(trace.raw);
    assert.equal(parsed.traceId, trace.traceId);
    assert.equal(parsed.version, "00");

    const fallbackFromMissing = parseTraceparent(undefined);
    assert.equal(fallbackFromMissing.version, "00");
    assert.equal(fallbackFromMissing.traceId.length, 32);

    const fallbackFromInvalid = parseTraceparent("invalid-header");
    assert.equal(fallbackFromInvalid.version, "00");
  });

  it("valida un UUID en QueryStatusSchema", () => {
    const valid = QueryStatusSchema.safeParse({
      transactionId: "550e8400-e29b-41d4-a716-446655440000",
    });
    assert.equal(valid.success, true);
  });
});

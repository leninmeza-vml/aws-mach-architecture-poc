import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TransactionRepository } from "./index";

describe("@poc-mach/database TransactionRepository", () => {
  it("inserta y recupera una transacción de forma tipada", async () => {
    const repo = new TransactionRepository(true);
    const id = randomUUID();
    const created = await repo.insertTransaction({
      transactionId: id,
      customerId: "CUST-100",
      amount: 1200.5,
      currency: "USD",
      concept: "Pago de licencia empresarial",
      status: "APPROVED",
      riskLevel: "LOW",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });

    assert.equal(created.transactionId, id);
    const found = await repo.findById(id);
    assert.ok(found);
    assert.equal(found?.customerId, "CUST-100");
  });
});

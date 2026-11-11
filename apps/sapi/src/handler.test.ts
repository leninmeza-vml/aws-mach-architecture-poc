import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { handler } from "./handler";

describe("@poc-mach/sapi handler", () => {
  it("persiste y consulta una transacción en la capa System API", async () => {
    const id = randomUUID();
    const createRes = await handler({
      action: "PERSIST_TRANSACTION",
      traceparent:
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      payload: {
        transactionId: id,
        customerId: "CUST-SAPI-01",
        amount: 250,
        currency: "USD",
        concept: "Prueba sAPI",
        status: "APPROVED",
        riskLevel: "LOW",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      },
    });

    assert.equal(createRes.statusCode, 201);
    assert.equal(createRes.data?.transactionId, id);

    const getRes = await handler({
      action: "GET_TRANSACTION_BY_ID",
      traceparent:
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      payload: { transactionId: id },
    });

    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.data?.customerId, "CUST-SAPI-01");
  });
});

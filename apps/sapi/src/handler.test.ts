import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TransactionRepository } from "@poc-mach/database";
import { handler, SapiCommand } from "./handler";

describe("@poc-mach/sapi handler", () => {
  it("persiste y consulta una transacción en la capa System API (201 y 200)", async () => {
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

    const truncateRes = await handler({
      action: "TRUNCATE_TRANSACTIONS",
      traceparent:
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    });
    assert.equal(truncateRes.statusCode, 200);
    assert.equal(truncateRes.truncateData?.truncated, true);
  });

  it("retorna 404 cuando el transactionId no existe en sAPI", async () => {
    const missingId = randomUUID();
    const res = await handler({
      action: "GET_TRANSACTION_BY_ID",
      payload: { transactionId: missingId },
    });
    assert.equal(res.statusCode, 404);
    assert.ok(res.error?.includes(missingId));
  });

  it("retorna 400 para acciones no soportadas y 500 ante errores de repositorio", async () => {
    const unsupported = await handler({
      action: "UNKNOWN_ACTION",
      payload: {},
    } as unknown as SapiCommand);
    assert.equal(unsupported.statusCode, 400);

    const failingRepo = {
      async insertTransaction() {
        throw new Error("DB connection timeout");
      },
    } as unknown as TransactionRepository;

    const failed = await handler(
      {
        action: "PERSIST_TRANSACTION",
        payload: {
          transactionId: randomUUID(),
          customerId: "CUST-ERR",
          amount: 100,
          currency: "USD",
          concept: "Fallo controlado",
          status: "APPROVED",
          riskLevel: "LOW",
          traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        },
      },
      failingRepo
    );
    assert.equal(failed.statusCode, 500);
    assert.equal(failed.error, "DB connection timeout");
  });
});

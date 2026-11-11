import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  evaluateBusinessRules,
  handler,
  invokeRemoteSapiLambda,
  PapiRequest,
} from "./handler";

describe("@poc-mach/papi business rules & orchestration", () => {
  it("clasifica riesgo LOW, MEDIUM y HIGH según el monto", () => {
    assert.deepEqual(evaluateBusinessRules(500), {
      riskLevel: "LOW",
      status: "APPROVED",
    });
    assert.deepEqual(evaluateBusinessRules(25_000), {
      riskLevel: "MEDIUM",
      status: "APPROVED",
    });
    assert.deepEqual(evaluateBusinessRules(75_000), {
      riskLevel: "HIGH",
      status: "PENDING",
    });
  });

  it("orquesta la creación (PROCESS_CREATE_TRANSACTION) y consulta (PROCESS_QUERY_STATUS) delegando en sAPI", async () => {
    const createRes = await handler({
      operation: "PROCESS_CREATE_TRANSACTION",
      traceparent:
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      payload: {
        customerId: "CUST-PAPI-99",
        amount: 65_000,
        currency: "USD",
        concept: "Compra de infraestructura corporativa",
      },
    });

    assert.equal(createRes.statusCode, 201);
    assert.equal(createRes.data?.riskLevel, "HIGH");
    assert.equal(createRes.data?.status, "PENDING");
    assert.ok(createRes.data?.transactionId);

    const queryRes = await handler({
      operation: "PROCESS_QUERY_STATUS",
      traceparent: createRes.traceparent,
      payload: {
        transactionId: createRes.data.transactionId,
      },
    });

    assert.equal(queryRes.statusCode, 200);
    assert.equal(queryRes.data?.customerId, "CUST-PAPI-99");

    const truncateRes = await handler({
      operation: "PROCESS_TRUNCATE_TRANSACTIONS",
      traceparent: queryRes.traceparent,
    });
    assert.equal(truncateRes.statusCode, 200);
    assert.equal(truncateRes.truncateData?.truncated, true);
  });

  it("retorna 400 ante una operación no reconocida y soporta invokeRemoteSapiLambda", async () => {
    const invalidRes = await handler({
      operation: "UNKNOWN_OP",
      payload: {},
    } as unknown as PapiRequest);
    assert.equal(invalidRes.statusCode, 400);

    const mockTxId = randomUUID();
    const remoteRes = await invokeRemoteSapiLambda(
      "wppes-mach-poc-dev-mxc1-lmb-sapi",
      {
        action: "GET_TRANSACTION_BY_ID",
        payload: { transactionId: mockTxId },
      },
      () => ({
        LambdaClient: class {
          async send() {
            return {
              Payload: new Uint8Array(
                Buffer.from(
                  JSON.stringify({
                    statusCode: 200,
                    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
                  })
                )
              ),
            };
          }
        },
        InvokeCommand: class {
          constructor(public readonly input: unknown) {}
        },
      })
    );
    assert.equal(remoteRes.statusCode, 200);
  });
});

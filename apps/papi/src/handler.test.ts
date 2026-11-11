import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateBusinessRules, handler } from "./handler";

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

  it("orquesta la creación y consulta delegando en sAPI", async () => {
    const res = await handler({
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

    assert.equal(res.statusCode, 201);
    assert.equal(res.data?.riskLevel, "HIGH");
    assert.equal(res.data?.status, "PENDING");
  });
});

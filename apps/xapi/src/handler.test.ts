import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handler } from "./handler";

describe("@poc-mach/xapi Experience API handler", () => {
  it("rechaza peticiones sin JWT Bearer (401)", async () => {
    const res = await handler({
      requestContext: {
        http: { method: "POST", path: "/v1/transactions" },
      },
      headers: {},
      body: JSON.stringify({}),
    });
    assert.equal(res.statusCode, 401);
  });

  it("ejecuta el flujo completo xAPI -> pAPI -> sAPI para POST y GET", async () => {
    const traceparent =
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const postRes = await handler({
      requestContext: {
        http: { method: "POST", path: "/v1/transactions" },
      },
      headers: {
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo",
        traceparent,
      },
      body: JSON.stringify({
        customerId: "CUST-XAPI-777",
        amount: 1500,
        currency: "USD",
        concept: "Orden desde canal web Headless",
      }),
    });

    assert.equal(postRes.statusCode, 201);
    const created = JSON.parse(postRes.body) as { transactionId: string; traceId: string };
    assert.ok(created.transactionId);
    assert.equal(created.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");

    const getRes = await handler({
      requestContext: {
        http: {
          method: "GET",
          path: `/v1/transactions/${created.transactionId}`,
        },
      },
      headers: {
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo",
        traceparent,
      },
      pathParameters: {
        transactionId: created.transactionId,
      },
    });

    assert.equal(getRes.statusCode, 200);
    const fetched = JSON.parse(getRes.body) as { customerId: string };
    assert.equal(fetched.customerId, "CUST-XAPI-777");
  });
});

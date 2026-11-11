import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  handler,
  invokeRemotePapiLambda,
  ApiGatewayV2HttpEvent,
} from "./handler";

describe("@poc-mach/xapi Experience API handler", () => {
  it("responde 204 en preflight OPTIONS con cabeceras CORS y W3C traceparent", async () => {
    const res = await handler({
      requestContext: {
        http: { method: "OPTIONS", path: "/v1/transactions" },
      },
    });
    assert.equal(res.statusCode, 204);
    assert.ok(res.headers.traceparent);
  });

  it("rechaza peticiones sin JWT Bearer válido (401)", async () => {
    const res = await handler({
      requestContext: {
        http: { method: "POST", path: "/v1/transactions" },
      },
      headers: {
        authorization: "Bearer short",
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.statusCode, 401);
  });

  it("ejecuta el flujo completo xAPI -> pAPI -> sAPI para POST (201) y GET (200)", async () => {
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
    const created = JSON.parse(postRes.body) as {
      transactionId: string;
      traceId: string;
    };
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

    const deleteRes = await handler({
      requestContext: {
        http: {
          method: "DELETE",
          path: "/v1/transactions",
        },
      },
      headers: {
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo",
        traceparent,
      },
    });
    assert.equal(deleteRes.statusCode, 200);
    const truncated = JSON.parse(deleteRes.body) as { truncated: boolean };
    assert.equal(truncated.truncated, true);
  });

  it("valida contratos Zod en POST (400), GET inválido (400), método no permitido (405), error 500 e invokeRemotePapiLambda", async () => {
    const authHeaders = {
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo",
    };

    const badPost = await handler({
      requestContext: {
        http: { method: "POST", path: "/v1/transactions" },
      },
      headers: authHeaders,
      body: JSON.stringify({ customerId: "A", amount: -10 }),
    });
    assert.equal(badPost.statusCode, 400);

    const badGet = await handler({
      requestContext: {
        http: { method: "GET", path: "/v1/transactions/not-a-uuid" },
      },
      headers: authHeaders,
      pathParameters: { transactionId: "not-a-uuid" },
    });
    assert.equal(badGet.statusCode, 400);

    const methodNotAllowed = await handler({
      requestContext: {
        http: {
          method: "PUT" as "POST",
          path: "/v1/transactions",
        },
      },
      headers: authHeaders,
    } as ApiGatewayV2HttpEvent);
    assert.equal(methodNotAllowed.statusCode, 405);

    const error500 = await handler({
      requestContext: {
        http: { method: "POST", path: "/v1/transactions" },
      },
      headers: authHeaders,
      body: "{invalid-json",
    });
    assert.equal(error500.statusCode, 500);

    const remoteRes = await invokeRemotePapiLambda(
      "wppes-mach-poc-dev-mxc1-lmb-papi",
      {
        operation: "PROCESS_QUERY_STATUS",
        payload: { transactionId: randomUUID() },
      },
      () => ({
        LambdaClient: class {
          async send() {
            return {
              Payload: new Uint8Array(
                Buffer.from(
                  JSON.stringify({
                    statusCode: 200,
                    traceparent:
                      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
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

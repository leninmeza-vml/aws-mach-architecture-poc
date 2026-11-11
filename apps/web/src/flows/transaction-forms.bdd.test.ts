import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handler as xapiHandler } from "@poc-mach/xapi";
import {
  executeCreateTransactionFormFlow,
  executeQueryTransactionFormFlow,
  FetchLike,
  buildInitialHops,
  classifyTransactionRisk,
} from "./transaction-forms";

/**
 * Adaptador Fetch local que conecta los 2 formularios de apps/web directamente
 * con el pipeline real local xAPI -> pAPI -> sAPI -> TransactionRepository.
 */
function createLocalApiLedFetchAdapter(): FetchLike {
  return async (url, init) => {
    const parsedUrl = new URL(url);
    const method = (init?.method ?? "GET") as "GET" | "POST" | "OPTIONS";
    const path = parsedUrl.pathname;
    const matchGet = /^\/v1\/transactions\/([^/]+)$/.exec(path);

    const apiGwRes = await xapiHandler({
      requestContext: {
        http: {
          method,
          path,
        },
      },
      headers: init?.headers,
      pathParameters: matchGet ? { transactionId: matchGet[1] } : undefined,
      body: init?.body ?? null,
    });

    return {
      ok: apiGwRes.statusCode >= 200 && apiGwRes.statusCode < 300,
      status: apiGwRes.statusCode,
      async json() {
        return JSON.parse(apiGwRes.body);
      },
    };
  };
}

describe("Feature BDD 1: Formulario 1 — Registrar Transacción (POST /v1/transactions)", () => {
  it("Scenario 1.1: Dado un formulario POST válido de monto bajo, Cuando se envía a xAPI, Entonces persiste en sAPI/DB con estado APPROVED, riesgo LOW y 6 saltos W3C", async () => {
    // Given (Dado)
    const localFetch = createLocalApiLedFetchAdapter();
    const formInput = {
      customerId: "CUST-WPPES-001",
      amountInput: "1250.50",
      currency: "USD" as const,
      concept: "Licencia anual plataforma MACH Composable Commerce",
      jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
      baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
      existingHistory: [],
    };

    // When (Cuando)
    const result = await executeCreateTransactionFormFlow(formInput, localFetch);

    // Then (Entonces)
    assert.equal(result.ok, true);
    assert.equal(result.source, "aws-live");
    assert.equal(result.errorMessage, null);
    assert.ok(result.response);
    assert.equal(result.response.customerId, "CUST-WPPES-001");
    assert.equal(result.response.amount, 1250.5);
    assert.equal(result.response.status, "APPROVED");
    assert.equal(result.response.riskLevel, "LOW");
    assert.equal(result.hops.length, 6);
    assert.ok(result.hops.every((hop) => hop.status === "success"));
    assert.equal(result.updatedHistory.length, 1);
  });

  it("Scenario 1.2: Dado un formulario POST con montos MEDIUM (>10,000) y HIGH (>50,000), Cuando se procesa en pAPI, Entonces clasifica el riesgo y estado correctamente", async () => {
    // Given (Dado)
    const localFetch = createLocalApiLedFetchAdapter();
    assert.deepEqual(classifyTransactionRisk(25_000), {
      riskLevel: "MEDIUM",
      computedStatus: "APPROVED",
    });

    // When (Cuando) - Monto MEDIUM
    const mediumRes = await executeCreateTransactionFormFlow(
      {
        customerId: "CUST-VML-MED",
        amountInput: "25000",
        currency: "MXN",
        concept: "Contrato regional de servicios cloud",
        jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
        baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
      },
      localFetch
    );

    // When (Cuando) - Monto HIGH
    const highRes = await executeCreateTransactionFormFlow(
      {
        customerId: "CUST-VML-HIGH",
        amountInput: "75000",
        currency: "USD",
        concept: "Transformación global multi-mercado",
        jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
        baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
      },
      localFetch
    );

    // Then (Entonces)
    assert.equal(mediumRes.ok, true);
    assert.equal(mediumRes.response?.riskLevel, "MEDIUM");
    assert.equal(mediumRes.response?.status, "APPROVED");

    assert.equal(highRes.ok, true);
    assert.equal(highRes.response?.riskLevel, "HIGH");
    assert.equal(highRes.response?.status, "PENDING");
  });

  it("Scenario 1.3: Dado un formulario POST con campos inválidos, Cuando el usuario intenta enviarlo, Entonces Zod detiene el envío con error de validación", async () => {
    // Given (Dado)
    const invalidInput = {
      customerId: "AB",
      amountInput: "-50",
      currency: "USD" as const,
      concept: "No",
      jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
      baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
    };

    // When (Cuando)
    const result = await executeCreateTransactionFormFlow(invalidInput);

    // Then (Entonces)
    assert.equal(result.ok, false);
    assert.equal(result.source, "validation-error");
    assert.equal(result.response, null);
    assert.ok(result.errorMessage?.includes("customerId"));
    assert.ok(result.hops.every((h) => h.status === "idle"));
  });

  it("Scenario 1.4: Dado que el endpoint remoto devuelve error de red, Cuando se envía el formulario POST, Entonces activa el respaldo local manteniendo los 6 saltos W3C", async () => {
    // Given (Dado)
    const failingFetch: FetchLike = async () => ({
      ok: false,
      status: 503,
      async json() {
        return {};
      },
    });

    // When (Cuando)
    const result = await executeCreateTransactionFormFlow(
      {
        customerId: "CUST-OFFLINE-01",
        amountInput: "900",
        currency: "EUR",
        concept: "Pago con comilla simple ' de prueba",
        jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
        baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
      },
      failingFetch
    );

    // Then (Entonces)
    assert.equal(result.ok, true);
    assert.equal(result.source, "local-fallback");
    assert.equal(result.response?.customerId, "CUST-OFFLINE-01");
    assert.equal(result.hops.length, 6);
  });
});

describe("Feature BDD 2: Formulario 2 — Consultar Estado (GET /v1/transactions/{transactionId})", () => {
  it("Scenario 2.1: Dada una transacción creada en el Formulario 1, Cuando se consulta su UUID en el Formulario 2, Entonces retorna el registro exacto sin sobrescribir el estado del Formulario 1", async () => {
    // Given (Dado) - Transacción creada en Formulario 1
    const localFetch = createLocalApiLedFetchAdapter();
    const postResult = await executeCreateTransactionFormFlow(
      {
        customerId: "CUST-BDD-E2E",
        amountInput: "3400.00",
        currency: "MXN",
        concept: "Transacción E2E entre Formulario 1 y Formulario 2",
        jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
        baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
      },
      localFetch
    );
    assert.ok(postResult.response);
    const createdTxId = postResult.response.transactionId;

    // When (Cuando) - Consulta en Formulario 2
    const getResult = await executeQueryTransactionFormFlow(
      {
        queryId: createdTxId,
        jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
        baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
        existingHistory: postResult.updatedHistory,
      },
      localFetch
    );

    // Then (Entonces)
    assert.equal(getResult.ok, true);
    assert.equal(getResult.source, "aws-live");
    assert.equal(getResult.response?.transactionId, createdTxId);
    assert.equal(getResult.response?.customerId, "CUST-BDD-E2E");
    assert.equal(getResult.hops.length, 6);
    assert.ok(getResult.hops.every((hop) => hop.status === "success"));
    // El resultado de POST permanece intacto
    assert.equal(postResult.response.transactionId, createdTxId);
  });

  it("Scenario 2.2: Dado un identificador que no es UUID válido en el Formulario 2, Cuando el usuario presiona Consultar, Entonces QueryStatusSchema rechaza la consulta antes de invocar la red", async () => {
    // Given (Dado)
    const initialGetHops = buildInitialHops("GET");
    assert.equal(initialGetHops.length, 6);

    // When (Cuando)
    const getResult = await executeQueryTransactionFormFlow({
      queryId: "id-invalido-no-uuid",
      jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
      baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
    });

    // Then (Entonces)
    assert.equal(getResult.ok, false);
    assert.equal(getResult.source, "validation-error");
    assert.equal(getResult.response, null);
    assert.ok(getResult.errorMessage?.includes("UUID"));
  });

  it("Scenario 2.3: Dado un UUID válido no encontrado en red o modo offline, Cuando se consulta en el Formulario 2, Entonces resuelve con fallback seguro", async () => {
    // Given (Dado)
    const offlineFetch: FetchLike = async () => ({
      ok: false,
      status: 404,
      async json() {
        return {};
      },
    });

    // When (Cuando)
    const getResult = await executeQueryTransactionFormFlow(
      {
        queryId: "550e8400-e29b-41d4-a716-446655440000",
        jwtToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im14YzEtY29nbml0by1rZXkifQ.demo",
        baseUrl: "https://x9ghhi1zbc.execute-api.mx-central-1.amazonaws.com",
        existingHistory: [],
      },
      offlineFetch
    );

    // Then (Entonces)
    assert.equal(getResult.ok, true);
    assert.equal(getResult.source, "local-fallback");
    assert.equal(
      getResult.response?.transactionId,
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });
});

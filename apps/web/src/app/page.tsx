"use client";

import React, { useState } from "react";
import {
  CreateTransactionSchema,
  QueryStatusSchema,
  TransactionResponse,
  createTraceparent,
  Currency,
} from "@poc-mach/types";

const XAPI_BASE_URL =
  process.env.NEXT_PUBLIC_XAPI_URL ||
  "https://demo-xapi.execute-api.us-east-1.amazonaws.com";

export default function HomePage() {
  const [customerId, setCustomerId] = useState("CUST-9001");
  const [amount, setAmount] = useState("1250.00");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [concept, setConcept] = useState("Orden Enterprise MACH Cloud");
  const [jwtToken, setJwtToken] = useState(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.poc-mach-demo-token"
  );

  const [queryId, setQueryId] = useState("");
  const [lastTraceparent, setLastTraceparent] = useState("");
  const [result, setResult] = useState<TransactionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const parsed = CreateTransactionSchema.safeParse({
      customerId,
      amount: Number(amount),
      currency,
      concept,
    });

    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ")
      );
      return;
    }

    const trace = createTraceparent();
    setLastTraceparent(trace.raw);
    setLoading(true);

    try {
      const response = await fetch(`${XAPI_BASE_URL}/v1/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
          traceparent: trace.raw,
        },
        body: JSON.stringify(parsed.data),
      });

      const data = (await response.json()) as TransactionResponse;
      setResult(data);
      setQueryId(data.transactionId);
    } catch {
      const simulated: TransactionResponse = {
        transactionId: "550e8400-e29b-41d4-a716-446655440000",
        customerId: parsed.data.customerId,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        concept: parsed.data.concept,
        status: parsed.data.amount > 50000 ? "PENDING" : "APPROVED",
        riskLevel:
          parsed.data.amount > 50000
            ? "HIGH"
            : parsed.data.amount > 10000
            ? "MEDIUM"
            : "LOW",
        traceId: trace.traceId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setResult(simulated);
      setQueryId(simulated.transactionId);
    } finally {
      setLoading(false);
    }
  }

  async function handleQueryStatus(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const parsed = QueryStatusSchema.safeParse({ transactionId: queryId });
    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues.map((i) => i.message).join(" | ")
      );
      return;
    }

    const trace = createTraceparent();
    setLastTraceparent(trace.raw);
    setLoading(true);

    try {
      const response = await fetch(
        `${XAPI_BASE_URL}/v1/transactions/${parsed.data.transactionId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            traceparent: trace.raw,
          },
        }
      );
      const data = (await response.json()) as TransactionResponse;
      setResult(data);
    } catch {
      if (result && result.transactionId === parsed.data.transactionId) {
        setResult({ ...result, traceId: trace.traceId });
      } else {
        setErrorMessage(
          "No se pudo conectar al endpoint remoto de la xAPI. Verifica NEXT_PUBLIC_XAPI_URL."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <span
          style={{
            backgroundColor: "#1e293b",
            color: "#38bdf8",
            padding: "0.25rem 0.75rem",
            borderRadius: 999,
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          MACH + API-Led Connectivity (xAPI → pAPI → sAPI)
        </span>
        <h1 style={{ fontSize: "2rem", marginTop: "0.75rem", marginBottom: "0.5rem" }}>
          Portal Headless de Transacciones en AWS
        </h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>
          Exportación estática Next.js con validación Zod compartida y trazabilidad W3C{" "}
          <code>traceparent</code>.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <section
          style={{
            backgroundColor: "#1e293b",
            padding: "1.5rem",
            borderRadius: 12,
            border: "1px solid #334155",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>
            1. Registrar Transacción (POST xAPI)
          </h2>
          <form onSubmit={handleCreateTransaction} style={{ display: "grid", gap: "0.85rem" }}>
            <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.9rem" }}>
              Customer ID
              <input
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                style={{
                  padding: "0.6rem",
                  borderRadius: 6,
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#f8fafc",
                }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
              <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.9rem" }}>
                Monto
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    padding: "0.6rem",
                    borderRadius: 6,
                    border: "1px solid #475569",
                    backgroundColor: "#0f172a",
                    color: "#f8fafc",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.9rem" }}>
                Moneda
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  style={{
                    padding: "0.6rem",
                    borderRadius: 6,
                    border: "1px solid #475569",
                    backgroundColor: "#0f172a",
                    color: "#f8fafc",
                  }}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="MXN">MXN</option>
                  <option value="COP">COP</option>
                  <option value="PEN">PEN</option>
                </select>
              </label>
            </div>
            <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.9rem" }}>
              Concepto
              <input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                style={{
                  padding: "0.6rem",
                  borderRadius: 6,
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#f8fafc",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.9rem" }}>
              Cognito Bearer JWT
              <input
                value={jwtToken}
                onChange={(e) => setJwtToken(e.target.value)}
                style={{
                  padding: "0.6rem",
                  borderRadius: 6,
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#f8fafc",
                }}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "0.5rem",
                padding: "0.75rem",
                borderRadius: 8,
                border: "none",
                backgroundColor: "#0284c7",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {loading ? "Procesando..." : "Enviar a Experience API (xAPI)"}
            </button>
          </form>
        </section>

        <section
          style={{
            backgroundColor: "#1e293b",
            padding: "1.5rem",
            borderRadius: 12,
            border: "1px solid #334155",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>
              2. Consultar Estado (GET xAPI)
            </h2>
            <form onSubmit={handleQueryStatus} style={{ display: "grid", gap: "0.85rem" }}>
              <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.9rem" }}>
                Transaction UUID
                <input
                  placeholder="550e8400-e29b-41d4-a716-446655440000"
                  value={queryId}
                  onChange={(e) => setQueryId(e.target.value)}
                  style={{
                    padding: "0.6rem",
                    borderRadius: 6,
                    border: "1px solid #475569",
                    backgroundColor: "#0f172a",
                    color: "#f8fafc",
                  }}
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#0f766e",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Consultar Estado en xAPI
              </button>
            </form>
          </div>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              borderRadius: 8,
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ color: "#94a3b8", marginBottom: "0.35rem" }}>
              Header W3C <code>traceparent</code> emitido:
            </div>
            <code style={{ color: "#38bdf8", wordBreak: "break-all" }}>
              {lastTraceparent || "00-00000000000000000000000000000000-0000000000000000-01"}
            </code>
          </div>
        </section>
      </div>

      {errorMessage && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            borderRadius: 8,
            backgroundColor: "#7f1d1d",
            color: "#fecaca",
          }}
        >
          <strong>Error de Validación:</strong> {errorMessage}
        </div>
      )}

      {result && (
        <section
          style={{
            marginTop: "1.5rem",
            padding: "1.5rem",
            borderRadius: 12,
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Respuesta Tipada de la Transacción</h3>
          <pre
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: 8,
              overflowX: "auto",
              color: "#a7f3d0",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  TransactionRepository,
  getDatabasePool,
  resetDatabasePool,
  transactionsTable,
  QueryExecutor,
} from "./index";

describe("@poc-mach/database TransactionRepository", () => {
  it("exporta el esquema Drizzle transactionsTable y gestiona getDatabasePool", async () => {
    assert.ok(transactionsTable);

    resetDatabasePool();
    const poolWithConfig = getDatabasePool({
      host: "localhost",
      port: 5432,
      database: "wppes_mach_poc",
      user: "wppes_mach_admin",
      password: "secret",
      ssl: true,
    });
    assert.ok(poolWithConfig);
    await poolWithConfig.end();

    resetDatabasePool();
    process.env.DB_HOST = "rds.mx-central-1.amazonaws.com";
    const poolWithEnvHost = getDatabasePool();
    assert.ok(poolWithEnvHost);
    await poolWithEnvHost.end();
    delete process.env.DB_HOST;

    resetDatabasePool();
    const poolDefault = getDatabasePool();
    assert.ok(poolDefault);
    await poolDefault.end();
    resetDatabasePool();
  });

  it("inserta y recupera una transacción de forma tipada en memoria", async () => {
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

    const missing = await repo.findById(randomUUID());
    assert.equal(missing, null);

    const truncatedMem = await repo.truncateTransactions(
      "4bf92f3577b34da6a3ce929d0e0e4736"
    );
    assert.equal(truncatedMem.truncated, true);
    assert.ok(truncatedMem.deletedCount >= 1);
    assert.equal(await repo.findById(id), null);
  });

  it("ejecuta CREATE TABLE IF NOT EXISTS, INSERT, SELECT y TRUNCATE sobre PostgreSQL QueryExecutor", async () => {
    const executedQueries: string[] = [];
    const storedRows = new Map<string, Record<string, unknown>>();

    const mockExecutor: QueryExecutor = {
      async query(text: string, values?: unknown[]) {
        executedQueries.push(text.trim());
        if (text.includes("CREATE TABLE IF NOT EXISTS")) {
          return { rows: [], rowCount: 0 };
        }
        if (text.includes("SELECT COUNT(*)::int AS count")) {
          return { rows: [{ count: storedRows.size }], rowCount: 1 };
        }
        if (text.includes("TRUNCATE TABLE transactions")) {
          storedRows.clear();
          return { rows: [], rowCount: 0 };
        }
        if (text.includes("INSERT INTO transactions") && values) {
          const row = {
            transactionId: values[0],
            customerId: values[1],
            amount: values[2],
            currency: values[3],
            concept: values[4],
            status: values[5],
            riskLevel: values[6],
            traceId: values[7],
            createdAt: values[8],
            updatedAt: values[9],
          };
          storedRows.set(String(values[0]), row);
          return { rows: [row], rowCount: 1 };
        }
        if (text.includes("SELECT") && values) {
          const found = storedRows.get(String(values[0]));
          return found
            ? { rows: [found], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    const repo = new TransactionRepository(false, mockExecutor);
    const id = randomUUID();
    const inserted = await repo.insertTransaction({
      transactionId: id,
      customerId: "CUST-RDS-MXC1",
      amount: 4500.75,
      currency: "MXN",
      concept: "Persistencia RDS Querétaro",
      status: "APPROVED",
      riskLevel: "LOW",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });

    assert.equal(inserted.transactionId, id);
    assert.equal(inserted.currency, "MXN");
    assert.ok(
      executedQueries.some((q) => q.includes("CREATE TABLE IF NOT EXISTS"))
    );

    const queried = await repo.findById(id);
    assert.equal(queried?.customerId, "CUST-RDS-MXC1");

    const notFound = await repo.findById(randomUUID());
    assert.equal(notFound, null);

    const truncatedSql = await repo.truncateTransactions(
      "4bf92f3577b34da6a3ce929d0e0e4736"
    );
    assert.equal(truncatedSql.truncated, true);
    assert.equal(truncatedSql.deletedCount, 1);
    assert.ok(
      executedQueries.some((q) => q.includes("TRUNCATE TABLE transactions"))
    );
  });
});

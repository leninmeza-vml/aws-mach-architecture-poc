import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

export const transactionsTable = pgTable("transactions", {
  transactionId: uuid("transaction_id").primaryKey().defaultRandom(),
  customerId: varchar("customer_id", { length: 64 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  concept: varchar("concept", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  riskLevel: varchar("risk_level", { length: 16 }).notNull(),
  traceId: varchar("trace_id", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

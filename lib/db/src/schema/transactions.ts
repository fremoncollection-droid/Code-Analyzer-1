import { pgTable, uuid, varchar, numeric, integer, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { locationsTable } from "./locations";
import { usersTable } from "./users";

export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptNumber: varchar("receipt_number", { length: 50 }).notNull().unique(),
  locationId: uuid("location_id").references(() => locationsTable.id).notNull(),
  cashierId: uuid("cashier_id").references(() => usersTable.id),
  items: jsonb("items").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("completed"),
  momoPhone: varchar("momo_phone", { length: 20 }),
  momoNetwork: varchar("momo_network", { length: 20 }),
  momoReference: varchar("momo_reference", { length: 100 }),
  customerName: varchar("customer_name", { length: 200 }),
  customerPhone: varchar("customer_phone", { length: 30 }),
  notes: text("notes"),
  isVoided: boolean("is_voided").notNull().default(false),
  voidReason: text("void_reason"),
  synced: boolean("synced").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;

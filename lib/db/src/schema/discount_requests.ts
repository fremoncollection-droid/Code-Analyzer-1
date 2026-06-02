import { pgTable, uuid, varchar, numeric, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { transactionsTable } from "./transactions";

export const discountRequestsTable = pgTable("discount_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").references(() => transactionsTable.id),
  customerName: varchar("customer_name", { length: 200 }),
  requestedAmount: numeric("requested_amount", { precision: 12, scale: 2 }).notNull(),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  requestedBy: uuid("requested_by").references(() => usersTable.id).notNull(),
  approvedBy: uuid("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDiscountRequestSchema = createInsertSchema(discountRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiscountRequest = z.infer<typeof insertDiscountRequestSchema>;
export type DiscountRequest = typeof discountRequestsTable.$inferSelect;

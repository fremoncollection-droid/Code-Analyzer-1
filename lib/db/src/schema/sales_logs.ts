import { pgTable, uuid, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const salesLogsTable = pgTable("sales_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  salespersonId: uuid("salesperson_id").references(() => usersTable.id),
  salesMode: varchar("sales_mode", { length: 20 }).notNull().default("retail"),
  action: varchar("action", { length: 100 }).notNull(),
  details: text("details"),
  productId: uuid("product_id"),
  orderId: uuid("order_id"),
  quantity: integer("quantity"),
  unitPrice: varchar("unit_price", { length: 30 }),
  total: varchar("total", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalesLogSchema = createInsertSchema(salesLogsTable).omit({ id: true, createdAt: true });
export type InsertSalesLog = z.infer<typeof insertSalesLogSchema>;
export type SalesLog = typeof salesLogsTable.$inferSelect;

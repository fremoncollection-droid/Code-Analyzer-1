import { pgTable, uuid, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { inventoryTable } from "./inventory";
import { locationsTable } from "./locations";
import { usersTable } from "./users";

export const transfersTable = pgTable("transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").references(() => inventoryTable.id).notNull(),
  fromLocationId: uuid("from_location_id").references(() => locationsTable.id).notNull(),
  toLocationId: uuid("to_location_id").references(() => locationsTable.id).notNull(),
  quantity: integer("quantity").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  notes: text("notes"),
  requestedById: uuid("requested_by_id").references(() => usersTable.id),
  approvedById: uuid("approved_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTransferSchema = createInsertSchema(transfersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type Transfer = typeof transfersTable.$inferSelect;

import { pgTable, uuid, varchar, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { locationsTable } from "./locations";
import { usersTable } from "./users";

export const shiftsTable = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  locationId: uuid("location_id").references(() => locationsTable.id).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("scheduled"),
  openingFloat: numeric("opening_float", { precision: 12, scale: 2 }),
  closingFloat: numeric("closing_float", { precision: 12, scale: 2 }),
  expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }),
  expectedMoMo: numeric("expected_momo", { precision: 12, scale: 2 }),
  expectedCard: numeric("expected_card", { precision: 12, scale: 2 }),
  actualCash: numeric("actual_cash", { precision: 12, scale: 2 }),
  actualMoMo: numeric("actual_momo", { precision: 12, scale: 2 }),
  actualCard: numeric("actual_card", { precision: 12, scale: 2 }),
  varianceCash: numeric("variance_cash", { precision: 12, scale: 2 }),
  varianceMoMo: numeric("variance_momo", { precision: 12, scale: 2 }),
  varianceCard: numeric("variance_card", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shiftsTable.$inferSelect;

import { pgTable, uuid, text, varchar, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  pinHash: text("pin_hash"),
  role: varchar("role", { length: 20 }).notNull().default("cashier"),
  customerType: varchar("customer_type", { length: 20 }).default("retail"),
  wholesaleTier: integer("wholesale_tier"),
  monthlyTarget: numeric("monthly_target", { precision: 12, scale: 2 }),
  taxExempt: boolean("tax_exempt").default(false),
  locationId: uuid("location_id"),
  station: varchar("station", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

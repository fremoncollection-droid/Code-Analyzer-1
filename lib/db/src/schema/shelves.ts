import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shelvesTable = pgTable("shelves", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  zone: varchar("zone", { length: 100 }).notNull(),
  capacity: integer("capacity").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShelfSchema = createInsertSchema(shelvesTable).omit({ id: true, createdAt: true });
export type InsertShelf = z.infer<typeof insertShelfSchema>;
export type Shelf = typeof shelvesTable.$inferSelect;

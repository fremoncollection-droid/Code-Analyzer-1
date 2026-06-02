import { pgTable, uuid, varchar, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { locationsTable } from "./locations";
import { categoriesTable } from "./categories";
import { unitsTable } from "./units";
import { shelvesTable } from "./shelves";

export const inventoryTable = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  sku: varchar("sku", { length: 100 }).unique(),
  description: text("description"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  wholesalePrice1: numeric("wholesale_price_1", { precision: 12, scale: 2 }),
  wholesalePrice2: numeric("wholesale_price_2", { precision: 12, scale: 2 }),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").notNull().default(0),
  locationId: uuid("location_id").references(() => locationsTable.id),
  categoryId: uuid("category_id").references(() => categoriesTable.id),
  unitId: uuid("unit_id").references(() => unitsTable.id),
  shelfId: uuid("shelf_id").references(() => shelvesTable.id),
  unit: varchar("unit", { length: 30 }).default("piece"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventoryTable.$inferSelect;

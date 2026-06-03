import { pgTable, uuid, varchar, text, numeric, integer, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

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

export const locationsTable = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 30 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const unitsTable = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 10 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shelvesTable = pgTable("shelves", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  zone: varchar("zone", { length: 100 }).notNull(),
  capacity: integer("capacity").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptNumber: varchar("receipt_number", { length: 50 }).notNull().unique(),
  locationId: uuid("location_id").references(() => locationsTable.id).notNull(),
  shiftId: uuid("shift_id"),
  cashierId: uuid("cashier_id").references(() => usersTable.id),
  items: jsonb("items").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull(),
  taxBreakdown: jsonb("tax_breakdown"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("completed"),
  momoPhone: varchar("momo_phone", { length: 20 }),
  momoNetwork: varchar("momo_network", { length: 20 }),
  momoReference: varchar("momo_reference", { length: 100 }),
  salesMode: varchar("sales_mode", { length: 20 }).notNull().default("retail"),
  wholesaleTier: integer("wholesale_tier"),
  customerId: uuid("customer_id"),
  customerName: varchar("customer_name", { length: 200 }),
  customerPhone: varchar("customer_phone", { length: 30 }),
  notes: text("notes"),
  isVoided: boolean("is_voided").notNull().default(false),
  voidReason: text("void_reason"),
  approvedBy: uuid("approved_by"),
  synced: boolean("synced").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const auditLogTable = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id),
  approvedBy: uuid("approved_by").references(() => usersTable.id),
  action: varchar("action", { length: 100 }).notNull(),
  tableName: varchar("table_name", { length: 100 }),
  recordId: uuid("record_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  salesMode: varchar("sales_mode", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: varchar("value", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

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

export const leadsTable = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  status: varchar("status", { length: 30 }).notNull().default("new"),
  source: varchar("source", { length: 50 }).default("walk-in"),
  notes: text("notes"),
  estimatedValue: varchar("estimated_value", { length: 20 }),
  assignedTo: uuid("assigned_to").references(() => usersTable.id),
  locationId: uuid("location_id").references(() => locationsTable.id),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const tasksTable = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 30 }).notNull().default("call"),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  priority: varchar("priority", { length: 10 }).notNull().default("medium"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

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

export const userPermissionsTable = pgTable("user_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  module: varchar("module", { length: 50 }).notNull(),
  canView: boolean("can_view").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  canApprove: boolean("can_approve").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique("user_permissions_user_module_unique").on(table.userId, table.module),
]);

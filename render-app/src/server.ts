import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";
import { db, pool } from "./db.js";
import { authenticateToken, authorize } from "./auth.js";
import {
  usersTable, locationsTable, categoriesTable, unitsTable, shelvesTable,
  inventoryTable, transactionsTable, shiftsTable, transfersTable,
  auditLogTable, settingsTable, salesLogsTable, leadsTable, tasksTable,
  discountRequestsTable, userPermissionsTable,
} from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const JWT_SECRET = process.env.JWT_SECRET ?? "mirrortech-dev-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "mirrortech-dev-refresh-secret";

// Simple console logging (no pino, no workers)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.use(cors());
// Raw body must be before express.json() for Paystack webhook signature verification
app.use("/api/payment/paystack-webhook", express.raw({ type: "*/*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use("/uploads", express.static(uploadsDir));

// Health check
app.get("/api/healthz", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", db: "connected", timestamp: result.rows[0].now });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// ============ AUTH ============
const pinAttempts = new Map<string, { count: number; lockedUntil: number }>();

function generateTokens(user: { id: string; username: string; email: string; role: string; locationId: string | null }) {
  const payload = { id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
  const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
  return { token, refreshToken };
}

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!user.isActive) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }
  const { token, refreshToken } = generateTokens(user);
  res.json({
    token, refreshToken,
    user: { id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId },
  });
});

app.post("/api/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) { res.status(400).json({ error: "refreshToken required" }); return; }
  let payload: { id: string };
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: string };
  } catch { res.status(401).json({ error: "Invalid refresh token" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.id)).limit(1);
  if (!user || !user.isActive) { res.status(401).json({ error: "User not found or disabled" }); return; }
  const tokens = generateTokens(user);
  res.json({ ...tokens, user: { id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId } });
});

app.post("/api/auth/pin-login", async (req, res) => {
  const { username, pin } = req.body as { username?: string; pin?: string };
  if (!username || !pin) { res.status(400).json({ error: "username and pin required" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
  const key = ip ? `${user.id}@${ip}` : user.id;
  const record = pinAttempts.get(key);
  if (record && record.lockedUntil > Date.now()) {
    const mins = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    res.status(429).json({ error: `Account locked. Try again in ${mins} minute(s).` });
    return;
  }
  if (!user.pinHash) { res.status(403).json({ error: "PIN not set" }); return; }
  const valid = await bcrypt.compare(pin, user.pinHash);
  if (!valid) {
    const r = pinAttempts.get(key);
    if (!r) pinAttempts.set(key, { count: 1, lockedUntil: 0 });
    else { r.count++; if (r.count >= 3) r.lockedUntil = Date.now() + 5 * 60 * 1000; }
    const remaining = r ? Math.max(0, 3 - r.count) : 2;
    res.status(401).json({ error: "Invalid PIN", remainingAttempts: remaining });
    return;
  }
  pinAttempts.delete(key);
  const { token, refreshToken } = generateTokens(user);
  res.json({ token, refreshToken, user: { id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId, station: user.station } });
});

app.post("/api/auth/manager-override", async (req, res) => {
  const { username, pin } = req.body as { username?: string; pin?: string };
  if (!username || !pin) { res.status(400).json({ error: "username and pin required" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user || (user.role !== "manager" && user.role !== "admin") || !user.pinHash) {
    res.status(401).json({ error: "Invalid credentials" }); return;
  }
  const valid = await bcrypt.compare(pin, user.pinHash);
  if (!valid) { res.status(401).json({ error: "Invalid PIN" }); return; }
  const overrideToken = jwt.sign({ id: user.id, username: user.username, role: user.role, type: "override" }, JWT_SECRET, { expiresIn: "5m" });
  res.json({ overrideToken, managerId: user.id, managerName: user.username, expiresIn: "5m" });
});

app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const token = authHeader.slice(7);
  let payload: { id: string };
  try { payload = jwt.verify(token, JWT_SECRET) as { id: string }; }
  catch { res.status(401).json({ error: "Invalid token" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId, station: user.station });
});

// ============ LOCATIONS ============
app.get("/api/locations", authenticateToken, async (req, res) => {
  const rows = await db.select().from(locationsTable).where(eq(locationsTable.isActive, true));
  res.json(rows);
});
app.post("/api/locations", authenticateToken, async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(locationsTable).values({ name, address, phone }).returning();
  res.status(201).json(row);
});
app.patch("/api/locations/:id", authenticateToken, async (req, res) => {
  const [row] = await db.update(locationsTable).set(req.body).where(eq(locationsTable.id, String(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// ============ CATEGORIES ============
app.get("/api/categories", authenticateToken, async (_req, res) => {
  const rows = await db.select().from(categoriesTable);
  res.json(rows);
});
app.post("/api/categories", authenticateToken, async (req, res) => {
  const { name, color, description } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(categoriesTable).values({ name, color: color ?? "#3B82F6", description }).returning();
  res.status(201).json(row);
});
app.patch("/api/categories/:id", authenticateToken, async (req, res) => {
  const { name, color, description } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.update(categoriesTable).set({ name, color, description }).where(eq(categoriesTable.id, String(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});
app.delete("/api/categories/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const linked = await db.select({ id: inventoryTable.id }).from(inventoryTable).where(and(eq(inventoryTable.categoryId, id), eq(inventoryTable.isActive, true))).limit(1);
  if (linked.length > 0) { res.status(400).json({ error: "Cannot delete: category has active inventory items" }); return; }
  const [row] = await db.delete(categoriesTable).where(eq(categoriesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ============ UNITS ============
app.get("/api/units", authenticateToken, async (_req, res) => {
  const rows = await db.select().from(unitsTable).orderBy(unitsTable.name);
  res.json(rows);
});
app.post("/api/units", authenticateToken, async (req, res) => {
  const { name, abbreviation } = req.body;
  if (!name || !abbreviation) { res.status(400).json({ error: "name and abbreviation required" }); return; }
  const [row] = await db.insert(unitsTable).values({ name, abbreviation }).returning();
  res.status(201).json(row);
});
app.put("/api/units/:id", authenticateToken, async (req, res) => {
  const { name, abbreviation } = req.body;
  if (!name || !abbreviation) { res.status(400).json({ error: "name and abbreviation required" }); return; }
  const [row] = await db.update(unitsTable).set({ name, abbreviation }).where(eq(unitsTable.id, String(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});
app.delete("/api/units/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const linked = await db.select({ id: inventoryTable.id }).from(inventoryTable).where(and(eq(inventoryTable.unitId, id), eq(inventoryTable.isActive, true))).limit(1);
  if (linked.length > 0) { res.status(400).json({ error: "Cannot delete: items are currently assigned to this unit" }); return; }
  const [row] = await db.delete(unitsTable).where(eq(unitsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ============ SHELVES ============
app.get("/api/shelves", authenticateToken, async (_req, res) => {
  const rows = await db.select().from(shelvesTable).orderBy(shelvesTable.name);
  res.json(rows);
});
app.post("/api/shelves", authenticateToken, async (req, res) => {
  const { name, zone, capacity } = req.body;
  if (!name || !zone) { res.status(400).json({ error: "name and zone required" }); return; }
  const [row] = await db.insert(shelvesTable).values({ name, zone, capacity: capacity ?? 0 }).returning();
  res.status(201).json(row);
});
app.put("/api/shelves/:id", authenticateToken, async (req, res) => {
  const { name, zone, capacity } = req.body;
  if (!name || !zone) { res.status(400).json({ error: "name and zone required" }); return; }
  const [row] = await db.update(shelvesTable).set({ name, zone, capacity: capacity ?? 0 }).where(eq(shelvesTable.id, String(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});
app.delete("/api/shelves/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const linked = await db.select({ id: inventoryTable.id }).from(inventoryTable).where(and(eq(inventoryTable.shelfId, id), eq(inventoryTable.isActive, true))).limit(1);
  if (linked.length > 0) { res.status(400).json({ error: "Cannot delete: items are currently assigned to this shelf" }); return; }
  const [row] = await db.delete(shelvesTable).where(eq(shelvesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ============ INVENTORY ============
app.get("/api/inventory", authenticateToken, async (req, res) => {
  const { locationId, categoryId, search, lowStock } = req.query as Record<string, string>;
  const user = (req as any).user;
  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) {
    effectiveLocationId = user.locationId;
  }
  const conditions: any[] = [eq(inventoryTable.isActive, true)];
  if (effectiveLocationId) conditions.push(eq(inventoryTable.locationId, effectiveLocationId));
  if (categoryId) conditions.push(eq(inventoryTable.categoryId, categoryId));
  if (search) {
    conditions.push(sql`${inventoryTable.name} ILIKE ${`%${search}%`} OR ${inventoryTable.sku} ILIKE ${`%${search}%`}`);
  }
  if (lowStock === "true") conditions.push(lte(inventoryTable.quantity, inventoryTable.minQuantity));
  const items = await db
    .select({ id: inventoryTable.id, name: inventoryTable.name, sku: inventoryTable.sku, description: inventoryTable.description, price: inventoryTable.price, wholesalePrice1: inventoryTable.wholesalePrice1, wholesalePrice2: inventoryTable.wholesalePrice2, cost: inventoryTable.cost, quantity: inventoryTable.quantity, minQuantity: inventoryTable.minQuantity, locationId: inventoryTable.locationId, categoryId: inventoryTable.categoryId, categoryName: categoriesTable.name, unitId: inventoryTable.unitId, unitName: unitsTable.name, unitAbbreviation: unitsTable.abbreviation, shelfId: inventoryTable.shelfId, shelfName: shelvesTable.name, shelfZone: shelvesTable.zone, unit: inventoryTable.unit, isActive: inventoryTable.isActive, createdAt: inventoryTable.createdAt })
    .from(inventoryTable)
    .leftJoin(categoriesTable, eq(inventoryTable.categoryId, categoriesTable.id))
    .leftJoin(unitsTable, eq(inventoryTable.unitId, unitsTable.id))
    .leftJoin(shelvesTable, eq(inventoryTable.shelfId, shelvesTable.id))
    .where(and(...conditions))
    .orderBy(inventoryTable.name);
  res.json(items);
});
app.get("/api/inventory/:id", authenticateToken, async (req, res) => {
  const [item] = await db.select({ id: inventoryTable.id, name: inventoryTable.name, sku: inventoryTable.sku, description: inventoryTable.description, price: inventoryTable.price, wholesalePrice1: inventoryTable.wholesalePrice1, wholesalePrice2: inventoryTable.wholesalePrice2, cost: inventoryTable.cost, quantity: inventoryTable.quantity, minQuantity: inventoryTable.minQuantity, locationId: inventoryTable.locationId, categoryId: inventoryTable.categoryId, categoryName: categoriesTable.name, unit: inventoryTable.unit, isActive: inventoryTable.isActive, createdAt: inventoryTable.createdAt }).from(inventoryTable).leftJoin(categoriesTable, eq(inventoryTable.categoryId, categoriesTable.id)).where(eq(inventoryTable.id, String(req.params.id))).limit(1);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});
app.post("/api/inventory", authenticateToken, async (req, res) => {
  const { name, sku, description, price, wholesalePrice1, wholesalePrice2, cost, quantity, minQuantity, locationId, categoryId, unitId, shelfId, unit } = req.body;
  if (!name || !price) { res.status(400).json({ error: "name and price required" }); return; }
  const [item] = await db.insert(inventoryTable).values({ name, sku, description, price, wholesalePrice1, wholesalePrice2, cost, quantity: quantity ?? 0, minQuantity: minQuantity ?? 0, locationId, categoryId, unitId, shelfId, unit: unit ?? "piece" }).returning();
  res.status(201).json(item);
});
app.patch("/api/inventory/:id", authenticateToken, async (req, res) => {
  const allowed = ["name", "sku", "description", "price", "wholesalePrice1", "wholesalePrice2", "cost", "quantity", "minQuantity", "locationId", "categoryId", "unitId", "shelfId", "unit", "isActive"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in req.body) updates[key] = req.body[key];
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields" }); return; }
  const [item] = await db.update(inventoryTable).set(updates as any).where(eq(inventoryTable.id, String(req.params.id))).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});
app.delete("/api/inventory/:id", authenticateToken, async (req, res) => {
  await db.update(inventoryTable).set({ isActive: false }).where(eq(inventoryTable.id, String(req.params.id)));
  res.status(204).send();
});

// ============ TRANSACTIONS ============
function generateReceiptNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `MTR-${datePart}-${nanoid(6).toUpperCase()}`;
}

app.post("/api/transactions/sync", authenticateToken, async (req, res) => {
  const { transactions } = req.body as { transactions?: unknown[] };
  if (!Array.isArray(transactions)) { res.status(400).json({ error: "transactions array required" }); return; }
  const cashierId = (req as any).user.id;
  let synced = 0; const errors: string[] = [];
  for (const tx of transactions) {
    try {
      const t = tx as any;
      await db.insert(transactionsTable).values({
        receiptNumber: generateReceiptNumber(), locationId: t.locationId, cashierId, items: t.items,
        subtotal: String(t.subtotal), taxAmount: String(t.taxAmount), total: String(t.total),
        paymentMethod: t.paymentMethod ?? "cash", paymentStatus: "completed", momoPhone: t.momoPhone,
        momoNetwork: t.momoNetwork, momoReference: t.momoReference, customerName: t.customerName,
        customerPhone: t.customerPhone, notes: t.notes, synced: true,
      });
      synced++;
    } catch (e: any) { errors.push(e.message); }
  }
  res.json({ synced, failed: errors.length, errors });
});

app.get("/api/transactions", authenticateToken, async (req, res) => {
  const { locationId, startDate, endDate, paymentMethod, salesMode, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const user = (req as any).user;
  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) effectiveLocationId = user.locationId;
  const conditions: any[] = [eq(transactionsTable.isVoided, false)];
  if (effectiveLocationId) conditions.push(eq(transactionsTable.locationId, effectiveLocationId));
  if (startDate) conditions.push(gte(transactionsTable.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(transactionsTable.createdAt, new Date(endDate)));
  if (paymentMethod) conditions.push(eq(transactionsTable.paymentMethod, paymentMethod));
  if (salesMode) conditions.push(eq(transactionsTable.salesMode, salesMode));
  const [{ total }] = await db.select({ total: count() }).from(transactionsTable).where(and(...conditions));
  const data = await db.select({ id: transactionsTable.id, receiptNumber: transactionsTable.receiptNumber, locationId: transactionsTable.locationId, locationName: locationsTable.name, cashierId: transactionsTable.cashierId, cashierName: usersTable.username, items: transactionsTable.items, subtotal: transactionsTable.subtotal, taxAmount: transactionsTable.taxAmount, taxBreakdown: transactionsTable.taxBreakdown, total: transactionsTable.total, paymentMethod: transactionsTable.paymentMethod, paymentStatus: transactionsTable.paymentStatus, momoPhone: transactionsTable.momoPhone, momoNetwork: transactionsTable.momoNetwork, momoReference: transactionsTable.momoReference, salesMode: transactionsTable.salesMode, wholesaleTier: transactionsTable.wholesaleTier, customerId: transactionsTable.customerId, customerName: transactionsTable.customerName, customerPhone: transactionsTable.customerPhone, notes: transactionsTable.notes, isVoided: transactionsTable.isVoided, voidReason: transactionsTable.voidReason, createdAt: transactionsTable.createdAt }).from(transactionsTable).leftJoin(locationsTable, eq(transactionsTable.locationId, locationsTable.id)).leftJoin(usersTable, eq(transactionsTable.cashierId, usersTable.id)).where(and(...conditions)).orderBy(desc(transactionsTable.createdAt)).limit(parseInt(limit)).offset(parseInt(offset));
  res.json({ data, total });
});

app.post("/api/transactions", authenticateToken, async (req, res) => {
  const { locationId, items, subtotal, taxAmount, taxBreakdown, total, paymentMethod, momoPhone, momoNetwork, momoReference, customerId, customerName, customerPhone, notes, shiftId, salesMode, wholesaleTier } = req.body;
  if (!locationId || !items || !subtotal || !total || !paymentMethod) { res.status(400).json({ error: "locationId, items, subtotal, total, paymentMethod required" }); return; }
  const receiptNumber = generateReceiptNumber();
  const cashierId = (req as any).user.id;
  const sm = salesMode === "wholesale" ? "wholesale" : "retail";
  const [tx] = await db.insert(transactionsTable).values({ receiptNumber, locationId, cashierId, shiftId: shiftId ?? null, items, subtotal, taxAmount: taxAmount ?? "0", taxBreakdown: taxBreakdown ?? null, total, paymentMethod, paymentStatus: paymentMethod === "momo" ? "pending" : "completed", salesMode: sm, wholesaleTier: wholesaleTier ?? null, customerId: customerId ?? null, momoPhone, momoNetwork, momoReference, customerName, customerPhone, notes }).returning();
  for (const item of items) {
    if (item.itemId) await db.execute(sql`UPDATE inventory SET quantity = GREATEST(0, quantity - ${item.quantity}) WHERE id = ${item.itemId}`);
  }
  for (const item of items) {
    await db.insert(salesLogsTable).values({ salespersonId: cashierId, salesMode: sm, action: "sale_item", details: `Sold ${item.quantity} x ${item.name}`, productId: item.itemId, orderId: tx.id, quantity: item.quantity, unitPrice: item.price, total: item.total });
  }
  res.status(201).json(tx);
});

app.get("/api/transactions/:id", authenticateToken, async (req, res) => {
  const [tx] = await db.select({ id: transactionsTable.id, receiptNumber: transactionsTable.receiptNumber, locationId: transactionsTable.locationId, locationName: locationsTable.name, cashierId: transactionsTable.cashierId, cashierName: usersTable.username, items: transactionsTable.items, subtotal: transactionsTable.subtotal, taxAmount: transactionsTable.taxAmount, taxBreakdown: transactionsTable.taxBreakdown, total: transactionsTable.total, paymentMethod: transactionsTable.paymentMethod, paymentStatus: transactionsTable.paymentStatus, momoPhone: transactionsTable.momoPhone, momoNetwork: transactionsTable.momoNetwork, momoReference: transactionsTable.momoReference, customerName: transactionsTable.customerName, customerPhone: transactionsTable.customerPhone, notes: transactionsTable.notes, isVoided: transactionsTable.isVoided, voidReason: transactionsTable.voidReason, createdAt: transactionsTable.createdAt }).from(transactionsTable).leftJoin(locationsTable, eq(transactionsTable.locationId, locationsTable.id)).leftJoin(usersTable, eq(transactionsTable.cashierId, usersTable.id)).where(eq(transactionsTable.id, String(req.params.id))).limit(1);
  if (!tx) { res.status(404).json({ error: "Not found" }); return; }
  res.json(tx);
});

app.post("/api/transactions/:id/void", authenticateToken, async (req, res) => {
  const { reason, overrideToken } = req.body as { reason?: string; overrideToken?: string };
  if (!reason) { res.status(400).json({ error: "reason required" }); return; }
  const user = (req as any).user;
  let approvedBy: string | null = null;
  if (user.role === "cashier") {
    if (!overrideToken) { res.status(403).json({ error: "Manager override required" }); return; }
    try {
      const payload = jwt.verify(overrideToken, JWT_SECRET) as any;
      if (payload.type !== "override" || (payload.role !== "manager" && payload.role !== "admin")) { res.status(403).json({ error: "Invalid override" }); return; }
      approvedBy = payload.id;
    } catch { res.status(403).json({ error: "Invalid override token" }); return; }
  }
  const [tx] = await db.update(transactionsTable).set({ isVoided: true, voidReason: reason, approvedBy: approvedBy ?? null }).where(eq(transactionsTable.id, String(req.params.id))).returning();
  if (!tx) { res.status(404).json({ error: "Not found" }); return; }
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
  await db.insert(auditLogTable).values({ userId: user.id, action: "void", tableName: "transactions", recordId: tx.id, oldValues: { isVoided: false }, newValues: { isVoided: true, voidReason: reason }, approvedBy: approvedBy ?? null, ipAddress: ip ?? null, userAgent: req.headers["user-agent"] ?? null });
  res.json(tx);
});

app.get("/api/transactions/:id/receipt", authenticateToken, async (req, res) => {
  const [tx] = await db.select({ id: transactionsTable.id, receiptNumber: transactionsTable.receiptNumber, locationId: transactionsTable.locationId, locationName: locationsTable.name, cashierId: transactionsTable.cashierId, cashierName: usersTable.username, items: transactionsTable.items, subtotal: transactionsTable.subtotal, taxAmount: transactionsTable.taxAmount, total: transactionsTable.total, paymentMethod: transactionsTable.paymentMethod, paymentStatus: transactionsTable.paymentStatus, momoPhone: transactionsTable.momoPhone, momoNetwork: transactionsTable.momoNetwork, momoReference: transactionsTable.momoReference, customerName: transactionsTable.customerName, customerPhone: transactionsTable.customerPhone, notes: transactionsTable.notes, isVoided: transactionsTable.isVoided, voidReason: transactionsTable.voidReason, createdAt: transactionsTable.createdAt }).from(transactionsTable).leftJoin(locationsTable, eq(transactionsTable.locationId, locationsTable.id)).leftJoin(usersTable, eq(transactionsTable.cashierId, usersTable.id)).where(eq(transactionsTable.id, String(req.params.id))).limit(1);
  if (!tx) { res.status(404).json({ error: "Not found" }); return; }
  const [location] = await db.select().from(locationsTable).where(eq(locationsTable.id, tx.locationId)).limit(1);
  res.json({ transaction: tx, location: location ?? { id: tx.locationId, name: tx.locationName ?? "MirrorTech", address: null, phone: null, isActive: true }, graReceiptNumber: `GRA-${tx.receiptNumber}`, qrCode: null });
});

// ============ ANALYTICS ============
function getPeriodStart(period = "today"): Date {
  const now = new Date();
  switch (period) {
    case "week": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case "month": { const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
    case "year": { const d = new Date(now); d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d; }
    default: { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  }
}

app.get("/api/analytics/summary", authenticateToken, async (req, res) => {
  const { locationId, period = "today" } = req.query as Record<string, string>;
  const user = (req as any).user;
  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) effectiveLocationId = user.locationId;
  const startDate = getPeriodStart(period);
  const conditions: any[] = [eq(transactionsTable.isVoided, false), gte(transactionsTable.createdAt, startDate)];
  if (effectiveLocationId) conditions.push(eq(transactionsTable.locationId, effectiveLocationId));
  const [summary] = await db.select({ totalRevenue: sql<string>`COALESCE(SUM(${transactionsTable.total}), 0)`, totalTransactions: count(), cashSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.paymentMethod} = 'cash' THEN ${transactionsTable.total} ELSE 0 END), 0)`, momoSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.paymentMethod} = 'momo' THEN ${transactionsTable.total} ELSE 0 END), 0)`, cardSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.paymentMethod} = 'card' THEN ${transactionsTable.total} ELSE 0 END), 0)`, net30Sales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.paymentMethod} = 'net30' THEN ${transactionsTable.total} ELSE 0 END), 0)`, poSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.paymentMethod} = 'purchase_order' THEN ${transactionsTable.total} ELSE 0 END), 0)`, retailSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.salesMode} = 'retail' THEN ${transactionsTable.total} ELSE 0 END), 0)`, wholesaleSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.salesMode} = 'wholesale' THEN ${transactionsTable.total} ELSE 0 END), 0)` }).from(transactionsTable).where(and(...conditions));
  const [{ lowStockItems }] = await db.select({ lowStockItems: count() }).from(inventoryTable).where(and(eq(inventoryTable.isActive, true), sql`${inventoryTable.quantity} <= ${inventoryTable.minQuantity}`));
  const totalRevenue = parseFloat(summary.totalRevenue ?? "0");
  const totalTx = summary.totalTransactions ?? 0;
  res.json({ totalSales: totalRevenue, totalRevenue: totalRevenue.toFixed(2), totalTransactions: totalTx, averageOrderValue: totalTx > 0 ? (totalRevenue / totalTx).toFixed(2) : "0.00", cashSales: parseFloat(summary.cashSales ?? "0").toFixed(2), momoSales: parseFloat(summary.momoSales ?? "0").toFixed(2), cardSales: parseFloat(summary.cardSales ?? "0").toFixed(2), net30Sales: parseFloat(summary.net30Sales ?? "0").toFixed(2), poSales: parseFloat(summary.poSales ?? "0").toFixed(2), retailSales: parseFloat(summary.retailSales ?? "0").toFixed(2), wholesaleSales: parseFloat(summary.wholesaleSales ?? "0").toFixed(2), lowStockItems: lowStockItems ?? 0 });
});

app.get("/api/analytics/sales-by-day", authenticateToken, async (req, res) => {
  const { locationId, days = "7" } = req.query as Record<string, string>;
  const user = (req as any).user;
  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) effectiveLocationId = user.locationId;
  const startDate = new Date(); startDate.setDate(startDate.getDate() - parseInt(days)); startDate.setHours(0, 0, 0, 0);
  const conditions: any[] = [eq(transactionsTable.isVoided, false), gte(transactionsTable.createdAt, startDate)];
  if (effectiveLocationId) conditions.push(eq(transactionsTable.locationId, effectiveLocationId));
  const rows = await db.select({ date: sql<string>`DATE(${transactionsTable.createdAt})`, revenue: sql<string>`COALESCE(SUM(${transactionsTable.total}), 0)`, transactions: count() }).from(transactionsTable).where(and(...conditions)).groupBy(sql`DATE(${transactionsTable.createdAt})`).orderBy(sql`DATE(${transactionsTable.createdAt})`);
  res.json(rows.map(r => ({ date: r.date, revenue: parseFloat(r.revenue).toFixed(2), transactions: r.transactions })));
});

app.get("/api/analytics/top-items", authenticateToken, async (req, res) => {
  const { locationId, limit = "10" } = req.query as Record<string, string>;
  const user = (req as any).user;
  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) effectiveLocationId = user.locationId;
  const conditions: any[] = [eq(transactionsTable.isVoided, false)];
  if (effectiveLocationId) conditions.push(eq(transactionsTable.locationId, effectiveLocationId));
  const rows = await db.select({ items: transactionsTable.items }).from(transactionsTable).where(and(...conditions)).limit(500);
  const totals: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const row of rows) {
    const items = Array.isArray(row.items) ? row.items : [];
    for (const item of items as any[]) {
      const key = item.itemId ?? item.name;
      if (!totals[key]) totals[key] = { name: item.name, qty: 0, revenue: 0 };
      totals[key].qty += item.quantity ?? 1;
      totals[key].revenue += parseFloat(item.total ?? item.price ?? "0") * (item.quantity ?? 1);
    }
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1].qty - a[1].qty).slice(0, parseInt(limit)).map(([itemId, v]) => ({ itemId, name: v.name, quantitySold: v.qty, revenue: v.revenue.toFixed(2) }));
  res.json(sorted);
});

// ============ LEADS ============
app.get("/api/leads", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { status, search, locationId } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (user.role === "cashier") conditions.push(eq(leadsTable.assignedTo, user.id));
  else if (user.role === "manager" && user.locationId) conditions.push(eq(leadsTable.locationId, user.locationId));
  if (status) conditions.push(eq(leadsTable.status, status));
  if (locationId) conditions.push(eq(leadsTable.locationId, locationId));
  if (search) conditions.push(sql`${leadsTable.name} ILIKE ${`%${search}%`} OR ${leadsTable.phone} ILIKE ${`%${search}%`}`);
  const leads = await db.select({ id: leadsTable.id, name: leadsTable.name, phone: leadsTable.phone, email: leadsTable.email, status: leadsTable.status, source: leadsTable.source, notes: leadsTable.notes, estimatedValue: leadsTable.estimatedValue, assignedTo: leadsTable.assignedTo, locationId: leadsTable.locationId, lastContactedAt: leadsTable.lastContactedAt, createdAt: leadsTable.createdAt }).from(leadsTable).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(leadsTable.createdAt);
  res.json(leads);
});

app.get("/api/leads/pipeline/summary", authenticateToken, authorize("manager", "admin"), async (req, res) => {
  const user = (req as any).user;
  const conditions: any[] = [];
  if (user.role === "manager" && user.locationId) conditions.push(eq(leadsTable.locationId, user.locationId));
  const results = await db.select({ status: leadsTable.status, count: sql<number>`COUNT(*)::int` }).from(leadsTable).where(conditions.length > 0 ? and(...conditions) : undefined).groupBy(leadsTable.status);
  res.json(results);
});

app.get("/api/leads/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);
  const [lead] = await db.select({ id: leadsTable.id, name: leadsTable.name, phone: leadsTable.phone, email: leadsTable.email, status: leadsTable.status, source: leadsTable.source, notes: leadsTable.notes, estimatedValue: leadsTable.estimatedValue, assignedTo: leadsTable.assignedTo, locationId: leadsTable.locationId, lastContactedAt: leadsTable.lastContactedAt, createdAt: leadsTable.createdAt }).from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role === "cashier" && lead.assignedTo !== user.id) { res.status(403).json({ error: "You can only access your own leads" }); return; }
  if (user.role === "manager" && lead.locationId !== user.locationId) { res.status(403).json({ error: "This lead is not in your location" }); return; }
  res.json(lead);
});

app.post("/api/leads", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { name, phone, email, status, source, notes, estimatedValue, assignedTo, locationId } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  let a = assignedTo; let l = locationId;
  if (user.role === "cashier") { a = user.id; l = user.locationId ?? l; }
  else if (user.role === "manager" && !a && !l) { l = user.locationId; }
  const [lead] = await db.insert(leadsTable).values({ name, phone, email, status: status ?? "new", source: source ?? "walk-in", notes, estimatedValue, assignedTo: a, locationId: l }).returning();
  res.status(201).json(lead);
});

app.patch("/api/leads/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const [existing] = await db.select({ assignedTo: leadsTable.assignedTo, locationId: leadsTable.locationId }).from(leadsTable).where(eq(leadsTable.id, String(req.params.id))).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role === "cashier" && existing.assignedTo !== user.id) { res.status(403).json({ error: "Not yours" }); return; }
  if (user.role === "manager" && existing.locationId !== user.locationId) { res.status(403).json({ error: "Not your location" }); return; }
  const allowed = ["name", "phone", "email", "status", "source", "notes", "estimatedValue", "assignedTo", "locationId", "lastContactedAt"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in req.body) updates[key] = req.body[key];
  const [updated] = await db.update(leadsTable).set(updates as any).where(eq(leadsTable.id, String(req.params.id))).returning();
  res.json(updated);
});

app.delete("/api/leads/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const [existing] = await db.select({ assignedTo: leadsTable.assignedTo, locationId: leadsTable.locationId }).from(leadsTable).where(eq(leadsTable.id, String(req.params.id))).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role === "cashier" && existing.assignedTo !== user.id) { res.status(403).json({ error: "Not yours" }); return; }
  if (user.role === "manager" && existing.locationId !== user.locationId) { res.status(403).json({ error: "Not your location" }); return; }
  await db.delete(leadsTable).where(eq(leadsTable.id, String(req.params.id)));
  res.status(204).send();
});

// ============ TASKS ============
app.get("/api/tasks", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const conditions: any[] = [];
  if (user.role === "cashier") conditions.push(eq(tasksTable.userId, user.id));
  else if (user.role === "manager" && user.locationId) {
    const cashiers = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.role, "cashier"), eq(usersTable.locationId, user.locationId)));
    const ids = cashiers.map(c => c.id); ids.push(user.id);
    conditions.push(sql`${tasksTable.userId} IN (${ids.map(id => `'${id}'`).join(",")})`);
  }
  const rows = await db.select({ id: tasksTable.id, userId: tasksTable.userId, title: tasksTable.title, description: tasksTable.description, type: tasksTable.type, dueDate: tasksTable.dueDate, priority: tasksTable.priority, completed: tasksTable.completed, completedAt: tasksTable.completedAt, createdAt: tasksTable.createdAt, username: usersTable.username }).from(tasksTable).leftJoin(usersTable, eq(tasksTable.userId, usersTable.id)).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(tasksTable.dueDate);
  res.json(rows);
});

app.post("/api/tasks", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { title, description, type, dueDate, priority } = req.body;
  if (!title || !dueDate) { res.status(400).json({ error: "title and dueDate required" }); return; }
  const [task] = await db.insert(tasksTable).values({ userId: user.id, title, description, type: type ?? "call", dueDate: new Date(dueDate), priority: priority ?? "medium" }).returning();
  res.status(201).json(task);
});

app.patch("/api/tasks/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const [existing] = await db.select({ userId: tasksTable.userId }).from(tasksTable).where(eq(tasksTable.id, String(req.params.id))).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role === "cashier" && existing.userId !== user.id) { res.status(403).json({ error: "Not yours" }); return; }
  const allowed = ["title", "description", "type", "dueDate", "priority", "completed"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in req.body) updates[key] = req.body[key];
  if (updates.completed === true) updates.completedAt = new Date();
  const [updated] = await db.update(tasksTable).set(updates as any).where(eq(tasksTable.id, String(req.params.id))).returning();
  res.json(updated);
});
app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);
  const [existing] = await db.select({ userId: tasksTable.userId }).from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role === "cashier" && existing.userId !== user.id) { res.status(403).json({ error: "Not yours" }); return; }
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).send();
});

// ============ DISCOUNT REQUESTS ============
app.get("/api/discount-requests", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const conditions: any[] = [];
  if (user.role === "cashier") conditions.push(eq(discountRequestsTable.requestedBy, user.id));
  const rows = await db.select({ id: discountRequestsTable.id, transactionId: discountRequestsTable.transactionId, customerName: discountRequestsTable.customerName, requestedAmount: discountRequestsTable.requestedAmount, originalAmount: discountRequestsTable.originalAmount, reason: discountRequestsTable.reason, status: discountRequestsTable.status, requestedBy: discountRequestsTable.requestedBy, requesterName: usersTable.username, approvedBy: discountRequestsTable.approvedBy, approvedAt: discountRequestsTable.approvedAt, rejectionReason: discountRequestsTable.rejectionReason, createdAt: discountRequestsTable.createdAt }).from(discountRequestsTable).leftJoin(usersTable, eq(discountRequestsTable.requestedBy, usersTable.id)).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(discountRequestsTable.createdAt));
  res.json(rows);
});

app.post("/api/discount-requests", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { requestedAmount, originalAmount, reason, customerName } = req.body;
  if (!requestedAmount || !originalAmount || !reason) { res.status(400).json({ error: "requestedAmount, originalAmount, reason required" }); return; }
  const [req2] = await db.insert(discountRequestsTable).values({ requestedAmount, originalAmount, reason, customerName, requestedBy: user.id, status: "pending" }).returning();
  res.status(201).json(req2);
});

app.post("/api/discount-requests/:id/approve", authenticateToken, authorize("manager", "admin"), async (req, res) => {
  const [updated] = await db.update(discountRequestsTable).set({ status: "approved", approvedBy: (req as any).user.id, approvedAt: new Date() }).where(eq(discountRequestsTable.id, String(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

app.post("/api/discount-requests/:id/reject", authenticateToken, authorize("manager", "admin"), async (req, res) => {
  const { reason } = req.body as { reason?: string };
  const [updated] = await db.update(discountRequestsTable).set({ status: "rejected", approvedBy: (req as any).user.id, rejectionReason: reason ?? null }).where(eq(discountRequestsTable.id, String(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ============ PERMISSIONS ============
app.get("/api/permissions", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { userId } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (user.role === "admin") { if (userId) conditions.push(eq(userPermissionsTable.userId, userId)); }
  else conditions.push(eq(userPermissionsTable.userId, user.id));
  const perms = await db.select({ id: userPermissionsTable.id, userId: userPermissionsTable.userId, module: userPermissionsTable.module, canView: userPermissionsTable.canView, canCreate: userPermissionsTable.canCreate, canEdit: userPermissionsTable.canEdit, canDelete: userPermissionsTable.canDelete, canApprove: userPermissionsTable.canApprove }).from(userPermissionsTable).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(userPermissionsTable.module);
  res.json(perms);
});

app.put("/api/permissions/:userId", authenticateToken, authorize("admin"), async (req, res) => {
  const targetId = String(req.params.userId);
  const { module, canView, canCreate, canEdit, canDelete, canApprove } = req.body;
  if (!module) { res.status(400).json({ error: "module is required" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const [perm] = await db.insert(userPermissionsTable).values({ userId: targetId, module, canView: canView ?? false, canCreate: canCreate ?? false, canEdit: canEdit ?? false, canDelete: canDelete ?? false, canApprove: canApprove ?? false }).onConflictDoUpdate({ target: [userPermissionsTable.userId, userPermissionsTable.module], set: { canView: canView ?? false, canCreate: canCreate ?? false, canEdit: canEdit ?? false, canDelete: canDelete ?? false, canApprove: canApprove ?? false, updatedAt: new Date() } }).returning();
  res.json(perm);
});

app.delete("/api/permissions/:id", authenticateToken, authorize("admin"), async (req, res) => {
  await db.delete(userPermissionsTable).where(eq(userPermissionsTable.id, String(req.params.id)));
  res.status(204).send();
});

// ============ USERS ============
app.get("/api/users", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { role, search } = req.query as Record<string, string>;
  const conditions: any[] = [eq(usersTable.isActive, true)];
  if (role) conditions.push(eq(usersTable.role, role));
  if (search) conditions.push(sql`${usersTable.username} ILIKE ${`%${search}%`}`);
  if (user.role === "manager" && user.locationId) conditions.push(eq(usersTable.locationId, user.locationId));
  const rows = await db.select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, role: usersTable.role, locationId: usersTable.locationId, station: usersTable.station, customerType: usersTable.customerType, wholesaleTier: usersTable.wholesaleTier, monthlyTarget: usersTable.monthlyTarget, isActive: usersTable.isActive }).from(usersTable).where(and(...conditions));
  res.json(rows);
});

app.post("/api/users", authenticateToken, async (req, res) => {
  const { username, email, password, role, locationId, station, monthlyTarget } = req.body;
  if (!username || !email || !password) { res.status(400).json({ error: "username, email, password required" }); return; }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ username, email, passwordHash, role: role ?? "cashier", locationId, station, monthlyTarget: monthlyTarget ?? null }).returning();
  res.status(201).json({ id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId, station: user.station });
});

app.patch("/api/users/:id", authenticateToken, async (req, res) => {
  const allowed = ["username", "email", "role", "locationId", "station", "monthlyTarget", "isActive", "customerType", "wholesaleTier"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in req.body) updates[key] = req.body[key];
  if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 10);
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, String(req.params.id))).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role, locationId: user.locationId, station: user.station });
});

app.delete("/api/users/:id", authenticateToken, async (req, res) => {
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, String(req.params.id)));
  res.status(204).send();
});

// ============ SHIFTS ============
app.get("/api/shifts", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { locationId, status } = req.query as Record<string, string>;
  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) effectiveLocationId = user.locationId;
  const conditions: any[] = [];
  if (effectiveLocationId) conditions.push(eq(shiftsTable.locationId, effectiveLocationId));
  if (status) conditions.push(eq(shiftsTable.status, status));
  const rows = await db.select({ id: shiftsTable.id, userId: shiftsTable.userId, username: usersTable.username, locationId: shiftsTable.locationId, locationName: locationsTable.name, startTime: shiftsTable.startTime, endTime: shiftsTable.endTime, status: shiftsTable.status, openingFloat: shiftsTable.openingFloat, closingFloat: shiftsTable.closingFloat, expectedCash: shiftsTable.expectedCash, expectedMoMo: shiftsTable.expectedMoMo, expectedCard: shiftsTable.expectedCard, actualCash: shiftsTable.actualCash, actualMoMo: shiftsTable.actualMoMo, actualCard: shiftsTable.actualCard, varianceCash: shiftsTable.varianceCash, varianceMoMo: shiftsTable.varianceMoMo, varianceCard: shiftsTable.varianceCard, notes: shiftsTable.notes, createdAt: shiftsTable.createdAt }).from(shiftsTable).leftJoin(usersTable, eq(shiftsTable.userId, usersTable.id)).leftJoin(locationsTable, eq(shiftsTable.locationId, locationsTable.id)).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(shiftsTable.startTime));
  res.json(rows);
});

app.post("/api/shifts", authenticateToken, async (req, res) => {
  const { userId, locationId, startTime, endTime, status, openingFloat } = req.body;
  if (!userId || !locationId || !startTime) { res.status(400).json({ error: "userId, locationId, startTime required" }); return; }
  const [shift] = await db.insert(shiftsTable).values({ userId, locationId, startTime: new Date(startTime), endTime: endTime ? new Date(endTime) : null, status: status ?? "scheduled", openingFloat }).returning();
  res.status(201).json(shift);
});

app.patch("/api/shifts/:id", authenticateToken, async (req, res) => {
  const allowed = ["startTime", "endTime", "status", "openingFloat", "closingFloat", "expectedCash", "expectedMoMo", "expectedCard", "actualCash", "actualMoMo", "actualCard", "varianceCash", "varianceMoMo", "varianceCard", "notes"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in req.body) updates[key] = req.body[key];
  const [shift] = await db.update(shiftsTable).set(updates).where(eq(shiftsTable.id, String(req.params.id))).returning();
  if (!shift) { res.status(404).json({ error: "Not found" }); return; }
  res.json(shift);
});

// ============ TRANSFERS ============
app.get("/api/transfers", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { status, locationId } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (status) conditions.push(eq(transfersTable.status, status));
  if (locationId) {
    conditions.push(sql`${transfersTable.fromLocationId} = ${locationId} OR ${transfersTable.toLocationId} = ${locationId}`);
  }
  if (user.role === "manager" && user.locationId) {
    conditions.push(sql`${transfersTable.fromLocationId} = ${user.locationId} OR ${transfersTable.toLocationId} = ${user.locationId}`);
  }
  const rows = await db.select({ id: transfersTable.id, itemId: transfersTable.itemId, itemName: inventoryTable.name, fromLocationId: transfersTable.fromLocationId, fromLocationName: locationsTable.name, toLocationId: transfersTable.toLocationId, toLocationName: locationsTable.name, quantity: transfersTable.quantity, status: transfersTable.status, notes: transfersTable.notes, requestedById: transfersTable.requestedById, requestedByName: usersTable.username, approvedById: transfersTable.approvedById, approvedByName: usersTable.username, createdAt: transfersTable.createdAt }).from(transfersTable).leftJoin(inventoryTable, eq(transfersTable.itemId, inventoryTable.id)).leftJoin(locationsTable, eq(transfersTable.fromLocationId, locationsTable.id)).leftJoin(usersTable, eq(transfersTable.requestedById, usersTable.id)).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(transfersTable.createdAt));
  res.json(rows);
});

app.post("/api/transfers", authenticateToken, async (req, res) => {
  const { itemId, fromLocationId, toLocationId, quantity, notes } = req.body;
  if (!itemId || !fromLocationId || !toLocationId || !quantity) { res.status(400).json({ error: "itemId, fromLocationId, toLocationId, quantity required" }); return; }
  const [transfer] = await db.insert(transfersTable).values({ itemId, fromLocationId, toLocationId, quantity, notes, requestedById: (req as any).user.id, status: "pending" }).returning();
  res.status(201).json(transfer);
});

app.post("/api/transfers/:id/approve", authenticateToken, authorize("manager", "admin"), async (req, res) => {
  const [transfer] = await db.update(transfersTable).set({ status: "approved", approvedById: (req as any).user.id }).where(eq(transfersTable.id, String(req.params.id))).returning();
  if (!transfer) { res.status(404).json({ error: "Not found" }); return; }
  res.json(transfer);
});

// ============ SETTINGS ============
app.get("/api/settings", authenticateToken, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  if (!settings.vat_rate) settings.vat_rate = "15";
  res.json(settings);
});

app.get("/api/public/settings", async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  if (!settings.vat_rate) settings.vat_rate = "15";
  res.json(settings);
});

app.put("/api/settings", authenticateToken, authorize("admin"), async (req, res) => {
  for (const [key, value] of Object.entries(req.body as Record<string, string | number>)) {
    await db.insert(settingsTable).values({ key, value: String(value) }).onConflictDoUpdate({ target: settingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  }
  const rows = await db.select().from(settingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

// ============ LOGO UPLOAD ============
app.post("/api/upload/logo", authenticateToken, authorize("admin"), async (req, res) => {
  try {
    const base64Data = req.body.logo;
    if (!base64Data || typeof base64Data !== "string") {
      res.status(400).json({ error: "No logo data provided" });
      return;
    }
    // Extract base64 data if it includes data URI scheme
    const match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
    const buffer = match ? Buffer.from(match[1], "base64") : Buffer.from(base64Data, "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: "Logo too large (max 5MB)" });
      return;
    }
    const filename = `logo_${Date.now()}.png`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, buffer);
    const logoUrl = `/uploads/${filename}`;
    // Save to settings
    await db.insert(settingsTable).values({ key: "logo_url", value: logoUrl }).onConflictDoUpdate({ target: settingsTable.key, set: { value: logoUrl, updatedAt: new Date() } });
    res.json({ logoUrl });
  } catch (err) {
    console.error("Logo upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ============ SEED ============
app.post("/api/seed", async (_req, res) => {
  try {
    const [loc1] = await db.insert(locationsTable).values({ name: "MirrorTech - Accra Central", address: "123 High Street, Accra", phone: "+233201234567" }).returning().onConflictDoNothing() as any;
    const [loc2] = await db.insert(locationsTable).values({ name: "MirrorTech - Kumasi Branch", address: "45 Market Circle, Kumasi", phone: "+233244567890" }).returning().onConflictDoNothing() as any;
    const locs = await db.select().from(locationsTable).limit(2);
    const loc1Id = locs[0]?.id; const loc2Id = locs[1]?.id ?? locs[0]?.id;
    const ph = await bcrypt.hash("admin123", 10);
    const p = await bcrypt.hash("1234", 10);
    await db.insert(usersTable).values({ username: "admin", email: "admin@mirrortech.gh", passwordHash: ph, pinHash: p, role: "admin" }).onConflictDoUpdate({ target: usersTable.username, set: { passwordHash: ph, pinHash: p, role: "admin", updatedAt: new Date() } });
    await db.insert(usersTable).values({ username: "cashier1", email: "cashier1@mirrortech.gh", passwordHash: await bcrypt.hash("cash123", 10), pinHash: await bcrypt.hash("1234", 10), role: "cashier", locationId: loc1Id, station: "Counter 1" }).onConflictDoUpdate({ target: usersTable.username, set: { passwordHash: await bcrypt.hash("cash123", 10), pinHash: await bcrypt.hash("1234", 10), role: "cashier", locationId: loc1Id, station: "Counter 1", updatedAt: new Date() } });
    await db.insert(usersTable).values({ username: "cashier2", email: "cashier2@mirrortech.gh", passwordHash: await bcrypt.hash("cash123", 10), pinHash: await bcrypt.hash("4321", 10), role: "cashier", locationId: loc2Id, station: "Counter 2" }).onConflictDoUpdate({ target: usersTable.username, set: { passwordHash: await bcrypt.hash("cash123", 10), pinHash: await bcrypt.hash("4321", 10), role: "cashier", locationId: loc2Id, station: "Counter 2", updatedAt: new Date() } });
    await db.insert(usersTable).values({ username: "manager1", email: "manager@mirrortech.gh", passwordHash: await bcrypt.hash("mgr123", 10), pinHash: await bcrypt.hash("5678", 10), role: "manager", locationId: loc1Id }).onConflictDoUpdate({ target: usersTable.username, set: { passwordHash: await bcrypt.hash("mgr123", 10), pinHash: await bcrypt.hash("5678", 10), role: "manager", locationId: loc1Id, updatedAt: new Date() } });
    await db.insert(categoriesTable).values([
      { name: "Women's Wear", color: "#EC4899", description: "Ladies clothing, dresses, tops & skirts" },
      { name: "Men's Wear", color: "#3B82F6", description: "Gents clothing, shirts, trousers & suits" },
      { name: "Kids Wear", color: "#F59E0B", description: "Children's clothing for boys and girls" },
      { name: "Accessories", color: "#8B5CF6", description: "Bags, belts, scarves & fashion accessories" },
    ]).onConflictDoNothing();
    const cats = await db.select().from(categoriesTable).limit(4);
    const catIds = cats.map(c => c.id);
    if (loc1Id) {
      await db.insert(inventoryTable).values([
        { name: "Women's Evening Gown", sku: "WW-GOW-001", price: "380.00", cost: "180.00", wholesalePrice1: "310.00", wholesalePrice2: "280.00", quantity: 20, minQuantity: 4, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Ladies Floral Midi Dress", sku: "WW-FLO-002", price: "165.00", cost: "75.00", wholesalePrice1: "135.00", wholesalePrice2: "120.00", quantity: 35, minQuantity: 8, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Women's Palazzo Pants", sku: "WW-PAL-003", price: "110.00", cost: "50.00", wholesalePrice1: "88.00", wholesalePrice2: "80.00", quantity: 45, minQuantity: 10, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Ladies Office Blouse", sku: "WW-BLO-004", price: "85.00", cost: "38.00", wholesalePrice1: "68.00", wholesalePrice2: "62.00", quantity: 50, minQuantity: 10, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Women's Ankara Skirt Set", sku: "WW-ANK-005", price: "220.00", cost: "100.00", wholesalePrice1: "178.00", wholesalePrice2: "165.00", quantity: 30, minQuantity: 6, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Ladies Casual T-Shirt", sku: "WW-TEE-006", price: "55.00", cost: "22.00", wholesalePrice1: "42.00", wholesalePrice2: "38.00", quantity: 80, minQuantity: 15, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Men's Slim Fit Suit", sku: "MW-SUT-007", price: "650.00", cost: "320.00", wholesalePrice1: "530.00", wholesalePrice2: "490.00", quantity: 15, minQuantity: 3, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Men's Polo Shirt", sku: "MW-POL-008", price: "95.00", cost: "42.00", wholesalePrice1: "75.00", wholesalePrice2: "68.00", quantity: 60, minQuantity: 12, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Men's Chinos Trousers", sku: "MW-CHN-009", price: "130.00", cost: "58.00", wholesalePrice1: "105.00", wholesalePrice2: "95.00", quantity: 50, minQuantity: 10, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Men's Kaftan (Embroidered)", sku: "MW-KAF-010", price: "185.00", cost: "85.00", wholesalePrice1: "148.00", wholesalePrice2: "138.00", quantity: 25, minQuantity: 5, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Men's Casual Linen Shirt", sku: "MW-LIN-011", price: "115.00", cost: "50.00", wholesalePrice1: "92.00", wholesalePrice2: "84.00", quantity: 45, minQuantity: 8, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Girls' Sunday Dress", sku: "KW-GSD-012", price: "95.00", cost: "42.00", wholesalePrice1: "75.00", wholesalePrice2: "68.00", quantity: 40, minQuantity: 8, locationId: loc1Id, categoryId: catIds[2], unit: "piece" },
        { name: "Boys' School Uniform Set", sku: "KW-BSU-013", price: "120.00", cost: "55.00", wholesalePrice1: "96.00", wholesalePrice2: "88.00", quantity: 50, minQuantity: 10, locationId: loc1Id, categoryId: catIds[2], unit: "set" },
        { name: "Kids Denim Jeans", sku: "KW-DNM-014", price: "75.00", cost: "32.00", wholesalePrice1: "60.00", wholesalePrice2: "55.00", quantity: 60, minQuantity: 12, locationId: loc1Id, categoryId: catIds[2], unit: "piece" },
        { name: "Baby Romper Set (3-piece)", sku: "KW-ROM-015", price: "65.00", cost: "28.00", wholesalePrice1: "52.00", wholesalePrice2: "48.00", quantity: 55, minQuantity: 12, locationId: loc1Id, categoryId: catIds[2], unit: "set" },
        { name: "Kids Ankara Outfit", sku: "KW-ANK-016", price: "110.00", cost: "48.00", wholesalePrice1: "88.00", wholesalePrice2: "80.00", quantity: 35, minQuantity: 8, locationId: loc1Id, categoryId: catIds[2], unit: "piece" },
        { name: "Ladies Leather Handbag", sku: "AC-HBG-017", price: "195.00", cost: "90.00", wholesalePrice1: "155.00", wholesalePrice2: "142.00", quantity: 30, minQuantity: 5, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
        { name: "Women's Silk Headscarf", sku: "AC-SCF-018", price: "55.00", cost: "22.00", wholesalePrice1: "42.00", wholesalePrice2: "38.00", quantity: 70, minQuantity: 15, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
        { name: "Men's Leather Belt", sku: "AC-BLT-019", price: "75.00", cost: "32.00", wholesalePrice1: "60.00", wholesalePrice2: "55.00", quantity: 50, minQuantity: 10, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
        { name: "Fashion Sunglasses", sku: "AC-SGL-020", price: "85.00", cost: "35.00", wholesalePrice1: "68.00", wholesalePrice2: "62.00", quantity: 45, minQuantity: 10, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
      ]).onConflictDoUpdate({ target: inventoryTable.sku, set: { updatedAt: new Date() } });
    }
    res.json({ status: "seeded" });
  } catch (err) {
    res.status(500).json({ status: "error", error: String(err) });
  }
});

// ============ MOMO (Simulated) ============
const momoPayments = new Map<string, { status: string; phone: string; amount: string; network: string }>();

app.post("/api/momo/initiate", authenticateToken, async (req, res) => {
  const { phone, network, amount, reference } = req.body;
  if (!phone || !network || !amount) { res.status(400).json({ error: "phone, network, amount required" }); return; }
  const ref = reference ?? nanoid(12);
  momoPayments.set(ref, { status: "pending", phone, amount, network });
  res.json({ success: true, reference: ref, status: "pending", message: `Payment request recorded for ${phone}. Ask the customer to approve on their phone.` });
});

app.get("/api/momo/status/:reference", authenticateToken, async (req, res) => {
  const payment = momoPayments.get(String(req.params.reference));
  if (!payment) { res.json({ reference: req.params.reference, status: "not_found", amount: null, phone: null }); return; }
  res.json({ reference: req.params.reference, status: payment.status, amount: payment.amount, phone: payment.phone });
});

app.post("/api/momo/confirm/:reference", authenticateToken, (req, res) => {
  const payment = momoPayments.get(String(req.params.reference));
  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
  payment.status = "successful";
  res.json({ success: true, reference: req.params.reference, status: "successful" });
});

// ============ PAYSTACK PAYMENT ============
const PAYSTACK_BASE = "https://api.paystack.co";

app.post("/api/payment/charge-momo", authenticateToken, async (req: any, res: any) => {
  const { email, amount, phoneNumber, provider } = req.body;
  if (!email || !amount || !phoneNumber || !provider) {
    res.status(400).json({ error: "email, amount, phoneNumber, and provider are required" });
    return;
  }
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) { res.status(500).json({ error: "Paystack is not configured on this server" }); return; }

  const amountInPesewas = Math.round(amount * 100);
  try {
    const paystackRes = await fetch(`${PAYSTACK_BASE}/charge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount: amountInPesewas, currency: "GHS", mobile_money: { phone: phoneNumber, provider } }),
    });
    const data = await paystackRes.json() as any;
    if (!data.status) { res.status(400).json({ error: data.message ?? "Paystack charge failed" }); return; }
    const { reference, status } = data.data;
    res.json({ success: true, reference, status });
  } catch (err) {
    console.error("Paystack charge-momo error", err);
    res.status(500).json({ error: "Failed to initiate mobile money charge" });
  }
});

app.post("/api/payment/paystack-webhook", (req: any, res: any) => {
  res.sendStatus(200);
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return;
  const signature = req.headers["x-paystack-signature"] as string | undefined;
  if (!signature) { console.warn("Paystack webhook: missing signature"); return; }
  const hash = crypto.createHmac("sha512", secretKey).update(req.body as Buffer).digest("hex");
  if (hash !== signature) { console.warn("Paystack webhook: signature mismatch"); return; }
  let event: { event: string; data: any };
  try { event = JSON.parse((req.body as Buffer).toString("utf8")); } catch { return; }
  if (event.event === "charge.success") {
    const { reference, amount, currency, channel } = event.data;
    const amountInGHS = (amount / 100).toFixed(2);
    console.log(`Paystack charge.success — ref: ${reference}, GHS ${amountInGHS}, currency: ${currency}, channel: ${channel}`);
  }
});

// ============ STATIC FILES ============
app.use(express.static(path.join(__dirname, "../public")));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ============ AUTO-CREATE TABLES ============
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      pin_hash TEXT,
      role VARCHAR(20) NOT NULL DEFAULT 'cashier',
      customer_type VARCHAR(20) DEFAULT 'retail',
      wholesale_tier INTEGER,
      monthly_target NUMERIC(12,2),
      tax_exempt BOOLEAN DEFAULT false,
      location_id UUID,
      station VARCHAR(50),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      address TEXT,
      phone VARCHAR(30),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS units (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      abbreviation VARCHAR(10) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS shelves (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      zone VARCHAR(100) NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      sku VARCHAR(100) UNIQUE,
      description TEXT,
      price NUMERIC(12,2) NOT NULL,
      wholesale_price_1 NUMERIC(12,2),
      wholesale_price_2 NUMERIC(12,2),
      cost NUMERIC(12,2),
      quantity INTEGER NOT NULL DEFAULT 0,
      min_quantity INTEGER NOT NULL DEFAULT 0,
      location_id UUID REFERENCES locations(id),
      category_id UUID REFERENCES categories(id),
      unit_id UUID REFERENCES units(id),
      shelf_id UUID REFERENCES shelves(id),
      unit VARCHAR(30) DEFAULT 'piece',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      receipt_number VARCHAR(50) NOT NULL UNIQUE,
      location_id UUID NOT NULL REFERENCES locations(id),
      shift_id UUID,
      cashier_id UUID REFERENCES users(id),
      items JSONB NOT NULL,
      subtotal NUMERIC(12,2) NOT NULL,
      tax_amount NUMERIC(12,2) NOT NULL,
      tax_breakdown JSONB,
      total NUMERIC(12,2) NOT NULL,
      payment_method VARCHAR(30) NOT NULL,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'completed',
      momo_phone VARCHAR(20),
      momo_network VARCHAR(20),
      momo_reference VARCHAR(100),
      sales_mode VARCHAR(20) NOT NULL DEFAULT 'retail',
      wholesale_tier INTEGER,
      customer_id UUID,
      customer_name VARCHAR(200),
      customer_phone VARCHAR(30),
      notes TEXT,
      is_voided BOOLEAN NOT NULL DEFAULT false,
      void_reason TEXT,
      approved_by UUID,
      synced BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS shifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      location_id UUID NOT NULL REFERENCES locations(id),
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
      opening_float NUMERIC(12,2),
      closing_float NUMERIC(12,2),
      expected_cash NUMERIC(12,2),
      expected_momo NUMERIC(12,2),
      expected_card NUMERIC(12,2),
      actual_cash NUMERIC(12,2),
      actual_momo NUMERIC(12,2),
      actual_card NUMERIC(12,2),
      variance_cash NUMERIC(12,2),
      variance_momo NUMERIC(12,2),
      variance_card NUMERIC(12,2),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS transfers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_id UUID NOT NULL REFERENCES inventory(id),
      from_location_id UUID NOT NULL REFERENCES locations(id),
      to_location_id UUID NOT NULL REFERENCES locations(id),
      quantity INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT,
      requested_by_id UUID REFERENCES users(id),
      approved_by_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      table_name VARCHAR(100),
      record_id UUID,
      old_values JSONB,
      new_values JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      sales_mode VARCHAR(20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(100) NOT NULL UNIQUE,
      value VARCHAR(500) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS sales_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      salesperson_id UUID REFERENCES users(id),
      sales_mode VARCHAR(20) NOT NULL DEFAULT 'retail',
      action VARCHAR(100) NOT NULL,
      details TEXT,
      product_id UUID,
      order_id UUID,
      quantity INTEGER,
      unit_price VARCHAR(30),
      total VARCHAR(30),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      phone VARCHAR(30),
      email VARCHAR(255),
      status VARCHAR(30) NOT NULL DEFAULT 'new',
      source VARCHAR(50) DEFAULT 'walk-in',
      notes TEXT,
      estimated_value VARCHAR(20),
      assigned_to UUID REFERENCES users(id),
      location_id UUID REFERENCES locations(id),
      last_contacted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(30) NOT NULL DEFAULT 'call',
      due_date TIMESTAMPTZ NOT NULL,
      priority VARCHAR(10) NOT NULL DEFAULT 'medium',
      completed BOOLEAN NOT NULL DEFAULT false,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS discount_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID REFERENCES transactions(id),
      customer_name VARCHAR(200),
      requested_amount NUMERIC(12,2) NOT NULL,
      original_amount NUMERIC(12,2) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      requested_by UUID NOT NULL REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS user_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      module VARCHAR(50) NOT NULL,
      can_view BOOLEAN NOT NULL DEFAULT false,
      can_create BOOLEAN NOT NULL DEFAULT false,
      can_edit BOOLEAN NOT NULL DEFAULT false,
      can_delete BOOLEAN NOT NULL DEFAULT false,
      can_approve BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_permissions_user_module_unique UNIQUE (user_id, module)
    )`);
    console.log("Database tables initialized");
  } catch (err) {
    console.error("Database init error:", err);
  } finally {
    client.release();
  }
}

// ============ AUTO-CLEANUP ============
const RETENTION_DAYS = {
  transactions: 270,    // Keep 270 days of sales (9 months)
  audit_log: 180,       // Keep 180 days of audit (6 months)
  sales_logs: 180,      // Keep 180 days of sales logs (6 months)
};

async function runCleanup() {
  const now = new Date();
  try {
    // Delete old transactions
    const txResult = await pool.query(
      `DELETE FROM transactions WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS.transactions} days' RETURNING id`
    );
    if (txResult.rowCount > 0) {
      console.log(`Cleanup: deleted ${txResult.rowCount} old transactions (older than ${RETENTION_DAYS.transactions} days)`);
    }

    // Delete old audit logs
    const auditResult = await pool.query(
      `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS.audit_log} days' RETURNING id`
    );
    if (auditResult.rowCount > 0) {
      console.log(`Cleanup: deleted ${auditResult.rowCount} old audit logs (older than ${RETENTION_DAYS.audit_log} days)`);
    }

    // Delete old sales logs
    const salesResult = await pool.query(
      `DELETE FROM sales_logs WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS.sales_logs} days' RETURNING id`
    );
    if (salesResult.rowCount > 0) {
      console.log(`Cleanup: deleted ${salesResult.rowCount} old sales logs (older than ${RETENTION_DAYS.sales_logs} days)`);
    }

    // Get current database size estimate
    const sizeResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`Cleanup: database size is ${sizeResult.rows[0].size}`);

  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

// Schedule daily cleanup at 3 AM
function scheduleCleanup() {
  const now = new Date();
  const next3AM = new Date(now);
  next3AM.setHours(3, 0, 0, 0);
  if (next3AM <= now) next3AM.setDate(next3AM.getDate() + 1);
  const msUntil3AM = next3AM.getTime() - now.getTime();

  setTimeout(() => {
    runCleanup();
    // Then every 24 hours
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }, msUntil3AM);
  console.log(`Cleanup scheduled for ${next3AM.toISOString()}`);
}

// Admin endpoint to trigger cleanup manually
app.post("/api/cleanup", authenticateToken, authorize("admin"), async (req, res) => {
  const { days } = req.body as { days?: number };
  if (days) {
    RETENTION_DAYS.transactions = days;
    RETENTION_DAYS.audit_log = days;
    RETENTION_DAYS.sales_logs = days;
  }
  await runCleanup();
  const sizeResult = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
  res.json({ status: "cleaned", retentionDays: RETENTION_DAYS, databaseSize: sizeResult.rows[0].size });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 10000;
initDatabase().then(() => {
  runCleanup(); // Run once on startup
  scheduleCleanup();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});


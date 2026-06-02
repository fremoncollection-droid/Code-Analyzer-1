import { Router } from "express";
import { db, transactionsTable, inventoryTable, locationsTable, usersTable, auditLogTable } from "@workspace/db";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";
import { nanoid } from "nanoid";

const router = Router();

function generateReceiptNumber(locationCode = "MTR") {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `${locationCode}-${datePart}-${nanoid(6).toUpperCase()}`;
}

router.post("/sync", authenticateToken, async (req, res) => {
  const { transactions } = req.body as { transactions?: unknown[] };
  if (!Array.isArray(transactions)) {
    res.status(400).json({ error: "transactions array required" });
    return;
  }
  const cashierId = (req as any).user.id;
  let synced = 0;
  const errors: string[] = [];

  for (const tx of transactions) {
    try {
      const t = tx as any;
      const receiptNumber = generateReceiptNumber();
      await db.insert(transactionsTable).values({
        receiptNumber,
        locationId: t.locationId,
        cashierId,
        items: t.items,
        subtotal: String(t.subtotal),
        taxAmount: String(t.taxAmount),
        total: String(t.total),
        paymentMethod: t.paymentMethod ?? "cash",
        paymentStatus: "completed",
        momoPhone: t.momoPhone,
        momoNetwork: t.momoNetwork,
        momoReference: t.momoReference,
        customerName: t.customerName,
        customerPhone: t.customerPhone,
        notes: t.notes,
        synced: true,
      });
      synced++;
    } catch (e: any) {
      errors.push(e.message);
    }
  }

  res.json({ synced, failed: errors.length, errors });
});

router.get("/", authenticateToken, async (req, res) => {
  const { locationId, startDate, endDate, paymentMethod, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const user = (req as any).user;

  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) {
    effectiveLocationId = user.locationId;
  }

  const conditions = [eq(transactionsTable.isVoided, false)];
  if (effectiveLocationId) conditions.push(eq(transactionsTable.locationId, effectiveLocationId));
  if (startDate) conditions.push(gte(transactionsTable.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(transactionsTable.createdAt, new Date(endDate)));
  if (paymentMethod) conditions.push(eq(transactionsTable.paymentMethod, paymentMethod));

  const [{ total }] = await db
    .select({ total: count() })
    .from(transactionsTable)
    .where(and(...conditions));

  const data = await db
    .select({
      id: transactionsTable.id,
      receiptNumber: transactionsTable.receiptNumber,
      locationId: transactionsTable.locationId,
      locationName: locationsTable.name,
      cashierId: transactionsTable.cashierId,
      cashierName: usersTable.username,
      items: transactionsTable.items,
      subtotal: transactionsTable.subtotal,
      taxAmount: transactionsTable.taxAmount,
      total: transactionsTable.total,
      paymentMethod: transactionsTable.paymentMethod,
      paymentStatus: transactionsTable.paymentStatus,
      momoPhone: transactionsTable.momoPhone,
      momoNetwork: transactionsTable.momoNetwork,
      momoReference: transactionsTable.momoReference,
      customerName: transactionsTable.customerName,
      customerPhone: transactionsTable.customerPhone,
      notes: transactionsTable.notes,
      isVoided: transactionsTable.isVoided,
      voidReason: transactionsTable.voidReason,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .leftJoin(locationsTable, eq(transactionsTable.locationId, locationsTable.id))
    .leftJoin(usersTable, eq(transactionsTable.cashierId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  res.json({ data, total });
});

router.post("/", authenticateToken, async (req, res) => {
  const body = req.body as {
    locationId?: string; items?: any[]; subtotal?: string; taxAmount?: string;
    taxBreakdown?: any; total?: string; paymentMethod?: string; momoPhone?: string; momoNetwork?: string;
    momoReference?: string; customerName?: string; customerPhone?: string; notes?: string;
    shiftId?: string;
  };

  if (!body.locationId || !body.items || !body.subtotal || !body.total || !body.paymentMethod) {
    res.status(400).json({ error: "locationId, items, subtotal, total, paymentMethod required" });
    return;
  }

  const receiptNumber = generateReceiptNumber();
  const cashierId = (req as any).user.id;

  const [tx] = await db.insert(transactionsTable).values({
    receiptNumber,
    locationId: body.locationId,
    cashierId,
    shiftId: body.shiftId ?? null,
    items: body.items,
    subtotal: body.subtotal,
    taxAmount: body.taxAmount ?? "0",
    taxBreakdown: body.taxBreakdown ?? null,
    total: body.total,
    paymentMethod: body.paymentMethod,
    paymentStatus: body.paymentMethod === "momo" ? "pending" : "completed",
    momoPhone: body.momoPhone,
    momoNetwork: body.momoNetwork,
    momoReference: body.momoReference,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    notes: body.notes,
  }).returning();

  // Deduct inventory quantities
  for (const item of body.items) {
    if (item.itemId) {
      await db.execute(sql`
        UPDATE inventory SET quantity = GREATEST(0, quantity - ${item.quantity})
        WHERE id = ${item.itemId}
      `);
    }
  }

  res.status(201).json(tx);
});

router.get("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const [tx] = await db
    .select({
      id: transactionsTable.id,
      receiptNumber: transactionsTable.receiptNumber,
      locationId: transactionsTable.locationId,
      locationName: locationsTable.name,
      cashierId: transactionsTable.cashierId,
      cashierName: usersTable.username,
      items: transactionsTable.items,
      subtotal: transactionsTable.subtotal,
      taxAmount: transactionsTable.taxAmount,
      taxBreakdown: transactionsTable.taxBreakdown,
      total: transactionsTable.total,
      paymentMethod: transactionsTable.paymentMethod,
      paymentStatus: transactionsTable.paymentStatus,
      momoPhone: transactionsTable.momoPhone,
      momoNetwork: transactionsTable.momoNetwork,
      momoReference: transactionsTable.momoReference,
      customerName: transactionsTable.customerName,
      customerPhone: transactionsTable.customerPhone,
      notes: transactionsTable.notes,
      isVoided: transactionsTable.isVoided,
      voidReason: transactionsTable.voidReason,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .leftJoin(locationsTable, eq(transactionsTable.locationId, locationsTable.id))
    .leftJoin(usersTable, eq(transactionsTable.cashierId, usersTable.id))
    .where(eq(transactionsTable.id, id))
    .limit(1);

  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(tx);
});

router.post("/:id/void", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const { reason, overrideToken } = req.body as { reason?: string; overrideToken?: string };
  if (!reason) {
    res.status(400).json({ error: "reason required" });
    return;
  }

  const user = (req as any).user;
  const isCashier = user.role === "cashier";
  let approvedBy: string | null = null;

  if (isCashier) {
    if (!overrideToken) {
      res.status(403).json({ error: "Manager override required for void" });
      return;
    }
    try {
      const jwt = require("jsonwebtoken");
      const payload = jwt.verify(overrideToken, process.env.JWT_SECRET ?? "mirrortech-dev-secret") as any;
      if (payload.type !== "override" || (payload.role !== "manager" && payload.role !== "admin")) {
        res.status(403).json({ error: "Invalid override token" });
        return;
      }
      approvedBy = payload.id;
    } catch {
      res.status(403).json({ error: "Invalid or expired override token" });
      return;
    }
  }

  const [tx] = await db
    .update(transactionsTable)
    .set({ isVoided: true, voidReason: reason, approvedBy: approvedBy ?? null })
    .where(eq(transactionsTable.id, id))
    .returning();

  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
  await db.insert(auditLogTable).values({
    userId: user.id,
    action: "void",
    tableName: "transactions",
    recordId: id,
    oldValues: { isVoided: false, voidReason: null },
    newValues: { isVoided: true, voidReason: reason },
    approvedBy: approvedBy ?? null,
    ipAddress: ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  req.log.info({ txId: id, userId: user.id, reason, approvedBy }, "Transaction voided");
  res.json(tx);
});

router.get("/:id/receipt", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const [tx] = await db
    .select({
      id: transactionsTable.id,
      receiptNumber: transactionsTable.receiptNumber,
      locationId: transactionsTable.locationId,
      locationName: locationsTable.name,
      cashierId: transactionsTable.cashierId,
      cashierName: usersTable.username,
      items: transactionsTable.items,
      subtotal: transactionsTable.subtotal,
      taxAmount: transactionsTable.taxAmount,
      total: transactionsTable.total,
      paymentMethod: transactionsTable.paymentMethod,
      paymentStatus: transactionsTable.paymentStatus,
      momoPhone: transactionsTable.momoPhone,
      momoNetwork: transactionsTable.momoNetwork,
      momoReference: transactionsTable.momoReference,
      customerName: transactionsTable.customerName,
      customerPhone: transactionsTable.customerPhone,
      notes: transactionsTable.notes,
      isVoided: transactionsTable.isVoided,
      voidReason: transactionsTable.voidReason,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .leftJoin(locationsTable, eq(transactionsTable.locationId, locationsTable.id))
    .leftJoin(usersTable, eq(transactionsTable.cashierId, usersTable.id))
    .where(eq(transactionsTable.id, id))
    .limit(1);

  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  const [location] = await db.select().from(locationsTable).where(eq(locationsTable.id, tx.locationId)).limit(1);

  const graReceiptNumber = `GRA-${tx.receiptNumber}`;

  res.json({
    transaction: tx,
    location: location ?? { id: tx.locationId, name: tx.locationName ?? "MirrorTech", address: null, phone: null, isActive: true },
    graReceiptNumber,
    qrCode: null,
  });
});

export default router;

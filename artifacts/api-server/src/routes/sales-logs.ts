import { Router } from "express";
import { db, salesLogsTable, usersTable } from "@workspace/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const { salespersonId, salesMode, action, startDate, endDate, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (salespersonId) conditions.push(eq(salesLogsTable.salespersonId, salespersonId));
  if (salesMode) conditions.push(eq(salesLogsTable.salesMode, salesMode));
  if (action) conditions.push(eq(salesLogsTable.action, action));
  if (startDate) conditions.push(gte(salesLogsTable.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(salesLogsTable.createdAt, new Date(endDate)));

  const logs = await db
    .select({
      id: salesLogsTable.id,
      salespersonId: salesLogsTable.salespersonId,
      salespersonName: usersTable.username,
      salesMode: salesLogsTable.salesMode,
      action: salesLogsTable.action,
      details: salesLogsTable.details,
      productId: salesLogsTable.productId,
      orderId: salesLogsTable.orderId,
      quantity: salesLogsTable.quantity,
      unitPrice: salesLogsTable.unitPrice,
      total: salesLogsTable.total,
      createdAt: salesLogsTable.createdAt,
    })
    .from(salesLogsTable)
    .leftJoin(usersTable, eq(salesLogsTable.salespersonId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(salesLogsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  res.json(logs);
});

router.post("/", authenticateToken, async (req, res) => {
  const body = req.body as {
    action?: string;
    details?: string;
    productId?: string;
    orderId?: string;
    quantity?: number;
    unitPrice?: string;
    total?: string;
    salesMode?: string;
  };

  if (!body.action) {
    res.status(400).json({ error: "action required" });
    return;
  }

  const [log] = await db.insert(salesLogsTable).values({
    salespersonId: (req as any).user.id,
    salesMode: body.salesMode === "wholesale" ? "wholesale" : "retail",
    action: body.action,
    details: body.details ?? null,
    productId: body.productId ?? null,
    orderId: body.orderId ?? null,
    quantity: body.quantity ?? null,
    unitPrice: body.unitPrice ?? null,
    total: body.total ?? null,
  }).returning();

  res.status(201).json(log);
});

export default router;

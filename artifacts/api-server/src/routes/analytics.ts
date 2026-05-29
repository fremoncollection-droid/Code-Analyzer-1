import { Router } from "express";
import { db, transactionsTable, inventoryTable } from "@workspace/db";
import { eq, and, gte, lte, sql, count, lte as lteAlias } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

function getPeriodStart(period = "today"): Date {
  const now = new Date();
  switch (period) {
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month": {
      const d = new Date(now);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "year": {
      const d = new Date(now);
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    default: {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
}

router.get("/summary", authenticateToken, async (req, res) => {
  const { locationId, period = "today" } = req.query as Record<string, string>;
  const user = (req as any).user;

  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) {
    effectiveLocationId = user.locationId;
  }

  const startDate = getPeriodStart(period);
  const conditions: any[] = [
    eq(transactionsTable.isVoided, false),
    gte(transactionsTable.createdAt, startDate),
  ];
  if (effectiveLocationId) conditions.push(eq(transactionsTable.locationId, effectiveLocationId));

  const [summary] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${transactionsTable.total}), 0)`,
      totalTransactions: count(),
      cashSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.paymentMethod} = 'cash' THEN ${transactionsTable.total} ELSE 0 END), 0)`,
      momoSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.paymentMethod} = 'momo' THEN ${transactionsTable.total} ELSE 0 END), 0)`,
      cardSales: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.paymentMethod} = 'card' THEN ${transactionsTable.total} ELSE 0 END), 0)`,
    })
    .from(transactionsTable)
    .where(and(...conditions));

  const [{ lowStockItems }] = await db
    .select({ lowStockItems: count() })
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.isActive, true),
        sql`${inventoryTable.quantity} <= ${inventoryTable.minQuantity}`
      )
    );

  const totalRevenue = parseFloat(summary.totalRevenue ?? "0");
  const totalTx = summary.totalTransactions ?? 0;

  res.json({
    totalSales: totalRevenue,
    totalRevenue: totalRevenue.toFixed(2),
    totalTransactions: totalTx,
    averageOrderValue: totalTx > 0 ? (totalRevenue / totalTx).toFixed(2) : "0.00",
    cashSales: parseFloat(summary.cashSales ?? "0").toFixed(2),
    momoSales: parseFloat(summary.momoSales ?? "0").toFixed(2),
    cardSales: parseFloat(summary.cardSales ?? "0").toFixed(2),
    lowStockItems: lowStockItems ?? 0,
  });
});

router.get("/sales-by-day", authenticateToken, async (req, res) => {
  const { locationId, days = "7" } = req.query as Record<string, string>;
  const user = (req as any).user;

  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) {
    effectiveLocationId = user.locationId;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  startDate.setHours(0, 0, 0, 0);

  const conditions: any[] = [
    eq(transactionsTable.isVoided, false),
    gte(transactionsTable.createdAt, startDate),
  ];
  if (effectiveLocationId) conditions.push(eq(transactionsTable.locationId, effectiveLocationId));

  const rows = await db
    .select({
      date: sql<string>`DATE(${transactionsTable.createdAt})`,
      revenue: sql<string>`COALESCE(SUM(${transactionsTable.total}), 0)`,
      transactions: count(),
    })
    .from(transactionsTable)
    .where(and(...conditions))
    .groupBy(sql`DATE(${transactionsTable.createdAt})`)
    .orderBy(sql`DATE(${transactionsTable.createdAt})`);

  res.json(rows.map(r => ({ date: r.date, revenue: parseFloat(r.revenue).toFixed(2), transactions: r.transactions })));
});

router.get("/top-items", authenticateToken, async (req, res) => {
  const { locationId, limit = "10" } = req.query as Record<string, string>;
  const user = (req as any).user;

  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) {
    effectiveLocationId = user.locationId;
  }

  const conditions: any[] = [eq(transactionsTable.isVoided, false)];
  if (effectiveLocationId) conditions.push(eq(transactionsTable.locationId, effectiveLocationId));

  const rows = await db
    .select({
      items: transactionsTable.items,
    })
    .from(transactionsTable)
    .where(and(...conditions))
    .limit(500);

  // Aggregate item sales from JSON
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

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, parseInt(limit))
    .map(([itemId, v]) => ({
      itemId,
      name: v.name,
      quantitySold: v.qty,
      revenue: v.revenue.toFixed(2),
    }));

  res.json(sorted);
});

export default router;

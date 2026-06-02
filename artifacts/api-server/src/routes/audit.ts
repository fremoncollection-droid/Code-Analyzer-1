import { Router } from "express";
import { db, auditLogTable, usersTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, authorize("admin", "manager"), async (req, res) => {
  const { action, userId, startDate, endDate, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (action) conditions.push(eq(auditLogTable.action, action));
  if (userId) conditions.push(eq(auditLogTable.userId, userId));
  if (startDate) conditions.push(gte(auditLogTable.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(auditLogTable.createdAt, new Date(endDate)));

  const logs = await db
    .select({
      id: auditLogTable.id,
      userId: auditLogTable.userId,
      userName: usersTable.username,
      approvedBy: auditLogTable.approvedBy,
      action: auditLogTable.action,
      tableName: auditLogTable.tableName,
      recordId: auditLogTable.recordId,
      oldValues: auditLogTable.oldValues,
      newValues: auditLogTable.newValues,
      ipAddress: auditLogTable.ipAddress,
      userAgent: auditLogTable.userAgent,
      salesMode: auditLogTable.salesMode,
      createdAt: auditLogTable.createdAt,
    })
    .from(auditLogTable)
    .leftJoin(usersTable, eq(auditLogTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const approverIds = logs.filter(l => l.approvedBy).map(l => l.approvedBy);
  const approversMap = new Map<string, string>();
  if (approverIds.length > 0) {
    const approvers = await db
      .select({ id: usersTable.id, username: usersTable.username })
      .from(usersTable)
      .where(sql`${usersTable.id} IN (${approverIds.join(", ")})`);
    for (const a of approvers) approversMap.set(a.id, a.username);
  }

  res.json(logs.map(l => ({ ...l, approverName: l.approvedBy ? approversMap.get(l.approvedBy) ?? undefined : undefined })));
});

router.post("/", authenticateToken, async (req, res) => {
  const body = req.body as {
    userId?: string;
    action?: string;
    tableName?: string;
    recordId?: string;
    oldValues?: any;
    newValues?: any;
    approvedBy?: string;
    salesMode?: string;
  };

  if (!body.action) {
    res.status(400).json({ error: "action required" });
    return;
  }

  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
  const userAgent = req.headers["user-agent"];

  const [log] = await db.insert(auditLogTable).values({
    userId: body.userId ?? (req as any).user?.id,
    action: body.action,
    tableName: body.tableName,
    recordId: body.recordId,
    oldValues: body.oldValues ?? null,
    newValues: body.newValues ?? null,
    approvedBy: body.approvedBy ?? null,
    ipAddress: ip ?? null,
    userAgent: userAgent ?? null,
    salesMode: body.salesMode ?? null,
  }).returning();

  res.status(201).json(log);
});

export default router;

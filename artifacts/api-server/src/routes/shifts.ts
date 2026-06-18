import { Router } from "express";
import { db, shiftsTable, usersTable, locationsTable, transactionsTable, auditLogTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const { locationId, userId, status, startDate, endDate } = req.query as Record<string, string>;
  const user = (req as any).user;

  const conditions: any[] = [];
  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) {
    effectiveLocationId = user.locationId;
  }
  if (effectiveLocationId) conditions.push(eq(shiftsTable.locationId, effectiveLocationId));
  if (userId) conditions.push(eq(shiftsTable.userId, userId));
  if (status) conditions.push(eq(shiftsTable.status, status));
  if (startDate) conditions.push(gte(shiftsTable.startTime, new Date(startDate)));
  if (endDate) conditions.push(lte(shiftsTable.startTime, new Date(endDate)));

  const shifts = await db
    .select({
      id: shiftsTable.id,
      userId: shiftsTable.userId,
      userName: usersTable.username,
      locationId: shiftsTable.locationId,
      locationName: locationsTable.name,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      status: shiftsTable.status,
      openingFloat: shiftsTable.openingFloat,
      closingFloat: shiftsTable.closingFloat,
      expectedCash: shiftsTable.expectedCash,
      expectedMoMo: shiftsTable.expectedMoMo,
      expectedCard: shiftsTable.expectedCard,
      actualCash: shiftsTable.actualCash,
      actualMoMo: shiftsTable.actualMoMo,
      actualCard: shiftsTable.actualCard,
      varianceCash: shiftsTable.varianceCash,
      varianceMoMo: shiftsTable.varianceMoMo,
      varianceCard: shiftsTable.varianceCard,
      notes: shiftsTable.notes,
      createdAt: shiftsTable.createdAt,
    })
    .from(shiftsTable)
    .leftJoin(usersTable, eq(shiftsTable.userId, usersTable.id))
    .leftJoin(locationsTable, eq(shiftsTable.locationId, locationsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(shiftsTable.startTime));

  res.json(shifts);
});

router.post("/open", authenticateToken, async (req, res) => {
  const body = req.body as {
    userId?: string; locationId?: string; openingFloat?: string;
  };
  const user = (req as any).user;

  if (!body.userId || !body.locationId) {
    res.status(400).json({ error: "userId and locationId required" });
    return;
  }

  // Check if user already has an active shift
  const [existing] = await db.select().from(shiftsTable).where(
    and(eq(shiftsTable.userId, body.userId), eq(shiftsTable.status, "active"))
  ).limit(1);

  if (existing) {
    res.status(409).json({ error: "User already has an active shift", shiftId: existing.id });
    return;
  }

  const [shift] = await db.insert(shiftsTable).values({
    userId: body.userId,
    locationId: body.locationId,
    startTime: new Date(),
    status: "active",
    openingFloat: body.openingFloat ?? "0",
  }).returning();

  req.log.info({ shiftId: shift.id, userId: body.userId }, "Shift opened");

  const ipShiftOpen = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
  db.insert(auditLogTable).values({
    userId: body.userId,
    action: "shift_open",
    tableName: "shifts",
    recordId: shift.id,
    newValues: { locationId: body.locationId, openingFloat: body.openingFloat ?? "0" },
    ipAddress: ipShiftOpen ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  }).catch(() => {});

  res.status(201).json(shift);
});

router.post("/close", authenticateToken, async (req, res) => {
  const body = req.body as {
    shiftId?: string;
    actualCash?: string;
    actualMoMo?: string;
    actualCard?: string;
    closingFloat?: string;
  };
  const user = (req as any).user;

  if (!body.shiftId) {
    res.status(400).json({ error: "shiftId required" });
    return;
  }

  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, body.shiftId)).limit(1);
  if (!shift) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }

  if (shift.status !== "active") {
    res.status(400).json({ error: "Shift is not active" });
    return;
  }

  // Compute expected totals from transactions during this shift
  const results = await db.select({
    paymentMethod: transactionsTable.paymentMethod,
    total: sql<string>`COALESCE(SUM(${transactionsTable.total}), 0)`,
  }).from(transactionsTable).where(
    and(
      eq(transactionsTable.shiftId, body.shiftId),
      eq(transactionsTable.isVoided, false),
      gte(transactionsTable.createdAt, shift.startTime)
    )
  ).groupBy(transactionsTable.paymentMethod);

  const expected = {
    cash: "0",
    momo: "0",
    card: "0",
  };
  for (const row of results) {
    if (row.paymentMethod === "cash") expected.cash = row.total;
    if (row.paymentMethod === "momo") expected.momo = row.total;
    if (row.paymentMethod === "card") expected.card = row.total;
  }

  const actualCash = Number(body.actualCash ?? 0);
  const actualMoMo = Number(body.actualMoMo ?? 0);
  const actualCard = Number(body.actualCard ?? 0);
  const expCash = Number(expected.cash);
  const expMoMo = Number(expected.momo);
  const expCard = Number(expected.card);

  const [updated] = await db.update(shiftsTable).set({
    status: "completed",
    endTime: new Date(),
    closingFloat: body.closingFloat ?? "0",
    expectedCash: String(expCash),
    expectedMoMo: String(expMoMo),
    expectedCard: String(expCard),
    actualCash: String(actualCash),
    actualMoMo: String(actualMoMo),
    actualCard: String(actualCard),
    varianceCash: String(actualCash - expCash),
    varianceMoMo: String(actualMoMo - expMoMo),
    varianceCard: String(actualCard - expCard),
  }).where(eq(shiftsTable.id, body.shiftId)).returning();

  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
  await db.insert(auditLogTable).values({
    userId: user.id,
    action: "shift_close",
    tableName: "shifts",
    recordId: body.shiftId,
    oldValues: { status: "active" },
    newValues: {
      status: "completed",
      expectedCash: expCash, expectedMoMo: expMoMo, expectedCard: expCard,
      actualCash, actualMoMo, actualCard,
      varianceCash: actualCash - expCash, varianceMoMo: actualMoMo - expMoMo, varianceCard: actualCard - expCard,
    },
    ipAddress: ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  req.log.info({ shiftId: body.shiftId, varianceCash: actualCash - expCash }, "Shift closed with reconciliation");
  res.json({
    shift: updated,
    expected,
    actual: { cash: actualCash, momo: actualMoMo, card: actualCard },
    variance: { cash: actualCash - expCash, momo: actualMoMo - expMoMo, card: actualCard - expCard },
  });
});

router.get("/active/:userId", authenticateToken, async (req, res) => {
  const userId = String(req.params.userId);
  const [shift] = await db
    .select({
      id: shiftsTable.id,
      userId: shiftsTable.userId,
      userName: usersTable.username,
      locationId: shiftsTable.locationId,
      locationName: locationsTable.name,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      status: shiftsTable.status,
      openingFloat: shiftsTable.openingFloat,
      notes: shiftsTable.notes,
      createdAt: shiftsTable.createdAt,
    })
    .from(shiftsTable)
    .leftJoin(usersTable, eq(shiftsTable.userId, usersTable.id))
    .leftJoin(locationsTable, eq(shiftsTable.locationId, locationsTable.id))
    .where(and(eq(shiftsTable.userId, userId), eq(shiftsTable.status, "active")))
    .limit(1);

  res.json(shift ?? null);
});

router.post("/", authenticateToken, authorize("admin", "manager", "supervisor"), async (req, res) => {
  const body = req.body as {
    userId?: string; locationId?: string; startTime?: string;
    endTime?: string; notes?: string;
  };

  if (!body.userId || !body.locationId || !body.startTime) {
    res.status(400).json({ error: "userId, locationId, startTime required" });
    return;
  }

  const [shift] = await db.insert(shiftsTable).values({
    userId: body.userId,
    locationId: body.locationId,
    startTime: new Date(body.startTime),
    endTime: body.endTime ? new Date(body.endTime) : undefined,
    status: "scheduled",
    notes: body.notes,
  }).returning();

  res.status(201).json(shift);
});

router.get("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const [shift] = await db
    .select({
      id: shiftsTable.id,
      userId: shiftsTable.userId,
      userName: usersTable.username,
      locationId: shiftsTable.locationId,
      locationName: locationsTable.name,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      status: shiftsTable.status,
      openingFloat: shiftsTable.openingFloat,
      closingFloat: shiftsTable.closingFloat,
      expectedCash: shiftsTable.expectedCash,
      expectedMoMo: shiftsTable.expectedMoMo,
      expectedCard: shiftsTable.expectedCard,
      actualCash: shiftsTable.actualCash,
      actualMoMo: shiftsTable.actualMoMo,
      actualCard: shiftsTable.actualCard,
      varianceCash: shiftsTable.varianceCash,
      varianceMoMo: shiftsTable.varianceMoMo,
      varianceCard: shiftsTable.varianceCard,
      notes: shiftsTable.notes,
      createdAt: shiftsTable.createdAt,
    })
    .from(shiftsTable)
    .leftJoin(usersTable, eq(shiftsTable.userId, usersTable.id))
    .leftJoin(locationsTable, eq(shiftsTable.locationId, locationsTable.id))
    .where(eq(shiftsTable.id, id))
    .limit(1);

  if (!shift) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }
  res.json(shift);
});

router.patch("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const body = req.body as Record<string, unknown>;
  const allowed = ["endTime", "status", "openingFloat", "closingFloat", "notes", "expectedCash", "expectedMoMo", "expectedCard", "actualCash", "actualMoMo", "actualCard", "varianceCash", "varianceMoMo", "varianceCard"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "endTime" && body[key]) {
        updates[key] = new Date(body[key] as string);
      } else {
        updates[key] = body[key];
      }
    }
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  const [shift] = await db.update(shiftsTable).set(updates as any).where(eq(shiftsTable.id, id)).returning();
  if (!shift) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }
  res.json(shift);
});

router.delete("/:id", authenticateToken, authorize("admin", "manager"), async (req, res) => {
  const id = String(req.params.id);
  await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
  res.status(204).send();
});

export default router;

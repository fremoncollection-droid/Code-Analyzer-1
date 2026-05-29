import { Router } from "express";
import { db, shiftsTable, usersTable, locationsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
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
      openingCash: shiftsTable.openingCash,
      closingCash: shiftsTable.closingCash,
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

router.post("/", authenticateToken, authorize("admin", "manager", "supervisor"), async (req, res) => {
  const body = req.body as {
    userId?: string; locationId?: string; startTime?: string;
    endTime?: string; openingCash?: string; notes?: string;
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
    openingCash: body.openingCash,
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
      openingCash: shiftsTable.openingCash,
      closingCash: shiftsTable.closingCash,
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
  const allowed = ["endTime", "status", "openingCash", "closingCash", "notes"];
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

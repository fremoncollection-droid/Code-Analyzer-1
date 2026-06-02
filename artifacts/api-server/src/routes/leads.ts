import { Router } from "express";
import { db, leadsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

/**
 * GET /api/leads
 * Cashiers see only their own leads. Managers see leads in their location.
 * Admin sees all leads.
 */
router.get("/", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { status, search, locationId } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "cashier") {
    conditions.push(eq(leadsTable.assignedTo, user.id));
  } else if (user.role === "manager" && user.locationId) {
    conditions.push(eq(leadsTable.locationId, user.locationId));
  }

  if (status) conditions.push(eq(leadsTable.status, status));
  if (locationId) conditions.push(eq(leadsTable.locationId, locationId));
  if (search) {
    conditions.push(
      sql`${leadsTable.name} ILIKE ${`%${search}%`} OR ${leadsTable.phone} ILIKE ${`%${search}%`}`
    );
  }

  const leads = await db
    .select({
      id: leadsTable.id,
      name: leadsTable.name,
      phone: leadsTable.phone,
      email: leadsTable.email,
      status: leadsTable.status,
      source: leadsTable.source,
      notes: leadsTable.notes,
      estimatedValue: leadsTable.estimatedValue,
      assignedTo: leadsTable.assignedTo,
      locationId: leadsTable.locationId,
      lastContactedAt: leadsTable.lastContactedAt,
      createdAt: leadsTable.createdAt,
    })
    .from(leadsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(leadsTable.createdAt);

  res.json(leads);
});

/**
 * GET /api/leads/:id
 * Cashiers can only access their own leads.
 */
router.get("/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);

  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, id))
    .limit(1);

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (user.role === "cashier" && lead.assignedTo !== user.id) {
    res.status(403).json({ error: "You can only access your own leads" });
    return;
  }

  if (user.role === "manager" && lead.locationId !== user.locationId) {
    res.status(403).json({ error: "This lead is not in your location" });
    return;
  }

  res.json(lead);
});

/**
 * POST /api/leads
 * Cashiers create leads for themselves. Managers can assign to any cashier.
 */
router.post("/", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const body = req.body as {
    name?: string; phone?: string; email?: string; status?: string;
    source?: string; notes?: string; estimatedValue?: string;
    assignedTo?: string; locationId?: string;
  };

  if (!body.name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  let assignedTo = body.assignedTo;
  let locationId = body.locationId;

  if (user.role === "cashier") {
    assignedTo = user.id;
    locationId = user.locationId ?? locationId;
  } else if (user.role === "manager") {
    if (!assignedTo && !locationId) {
      locationId = user.locationId;
    }
  }

  const [lead] = await db.insert(leadsTable).values({
    name: body.name,
    phone: body.phone,
    email: body.email,
    status: body.status ?? "new",
    source: body.source ?? "walk-in",
    notes: body.notes,
    estimatedValue: body.estimatedValue,
    assignedTo,
    locationId,
  }).returning();

  res.status(201).json(lead);
});

/**
 * PATCH /api/leads/:id
 * Cashiers can only update their own leads.
 */
router.patch("/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);
  const body = req.body as Record<string, unknown>;

  const [existing] = await db
    .select({ assignedTo: leadsTable.assignedTo, locationId: leadsTable.locationId })
    .from(leadsTable)
    .where(eq(leadsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (user.role === "cashier" && existing.assignedTo !== user.id) {
    res.status(403).json({ error: "You can only edit your own leads" });
    return;
  }

  if (user.role === "manager" && existing.locationId !== user.locationId) {
    res.status(403).json({ error: "This lead is not in your location" });
    return;
  }

  const allowed = [
    "name", "phone", "email", "status", "source", "notes",
    "estimatedValue", "assignedTo", "locationId", "lastContactedAt",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const [updated] = await db
    .update(leadsTable)
    .set(updates as any)
    .where(eq(leadsTable.id, id))
    .returning();

  res.json(updated);
});

/**
 * DELETE /api/leads/:id
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);

  const [existing] = await db
    .select({ assignedTo: leadsTable.assignedTo, locationId: leadsTable.locationId })
    .from(leadsTable)
    .where(eq(leadsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (user.role === "cashier" && existing.assignedTo !== user.id) {
    res.status(403).json({ error: "You can only delete your own leads" });
    return;
  }

  if (user.role === "manager" && existing.locationId !== user.locationId) {
    res.status(403).json({ error: "This lead is not in your location" });
    return;
  }

  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.status(204).send();
});

/**
 * GET /api/leads/pipeline/summary
 * Manager/Admin only: get pipeline stage counts for their team
 */
router.get("/pipeline/summary", authenticateToken, authorize("manager", "admin"), async (req, res) => {
  const user = (req as any).user;

  const conditions: ReturnType<typeof eq>[] = [];
  if (user.role === "manager" && user.locationId) {
    conditions.push(eq(leadsTable.locationId, user.locationId));
  }

  const results = await db
    .select({
      status: leadsTable.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(leadsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(leadsTable.status);

  res.json(results);
});

export default router;

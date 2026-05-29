import { Router } from "express";
import { db, transfersTable, inventoryTable, locationsTable, usersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

const fromLoc = locationsTable;
const toLoc = { ...locationsTable };

router.get("/", authenticateToken, async (req, res) => {
  const { locationId, status } = req.query as Record<string, string>;
  const user = (req as any).user;

  const conditions: any[] = [];
  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) {
    effectiveLocationId = user.locationId;
  }
  if (effectiveLocationId) {
    conditions.push(
      or(
        eq(transfersTable.fromLocationId, effectiveLocationId),
        eq(transfersTable.toLocationId, effectiveLocationId)
      )
    );
  }
  if (status) conditions.push(eq(transfersTable.status, status));

  const transfers = await db
    .select({
      id: transfersTable.id,
      itemId: transfersTable.itemId,
      itemName: inventoryTable.name,
      fromLocationId: transfersTable.fromLocationId,
      toLocationId: transfersTable.toLocationId,
      quantity: transfersTable.quantity,
      status: transfersTable.status,
      notes: transfersTable.notes,
      requestedById: transfersTable.requestedById,
      approvedById: transfersTable.approvedById,
      createdAt: transfersTable.createdAt,
    })
    .from(transfersTable)
    .leftJoin(inventoryTable, eq(transfersTable.itemId, inventoryTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(transfersTable.createdAt);

  res.json(transfers);
});

router.post("/", authenticateToken, async (req, res) => {
  const body = req.body as {
    itemId?: string; fromLocationId?: string; toLocationId?: string; quantity?: number; notes?: string;
  };

  if (!body.itemId || !body.fromLocationId || !body.toLocationId || !body.quantity) {
    res.status(400).json({ error: "itemId, fromLocationId, toLocationId, quantity required" });
    return;
  }

  const [transfer] = await db.insert(transfersTable).values({
    itemId: body.itemId,
    fromLocationId: body.fromLocationId,
    toLocationId: body.toLocationId,
    quantity: body.quantity,
    status: "pending",
    notes: body.notes,
    requestedById: (req as any).user.id,
  }).returning();

  res.status(201).json(transfer);
});

router.post("/:id/approve", authenticateToken, authorize("admin", "manager"), async (req, res) => {
  const id = String(req.params.id);
  const [transfer] = await db.select().from(transfersTable).where(eq(transfersTable.id, id)).limit(1);
  if (!transfer) {
    res.status(404).json({ error: "Transfer not found" });
    return;
  }
  if (transfer.status !== "pending") {
    res.status(400).json({ error: "Transfer is not pending" });
    return;
  }

  // Check source stock
  const [item] = await db.select().from(inventoryTable).where(eq(inventoryTable.id, transfer.itemId)).limit(1);
  if (!item || item.quantity < transfer.quantity) {
    res.status(400).json({ error: "Insufficient stock at source location" });
    return;
  }

  // Deduct from source
  await db.update(inventoryTable).set({ quantity: item.quantity - transfer.quantity }).where(eq(inventoryTable.id, transfer.itemId));

  // Find or create destination item
  // For simplicity: update same item if it belongs to destination or create note
  const [updated] = await db
    .update(transfersTable)
    .set({ status: "completed", approvedById: (req as any).user.id })
    .where(eq(transfersTable.id, id))
    .returning();

  res.json(updated);
});

export default router;

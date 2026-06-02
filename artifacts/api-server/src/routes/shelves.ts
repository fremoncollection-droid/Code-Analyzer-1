import { Router } from "express";
import { db, shelvesTable, inventoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (_req, res) => {
  const shelves = await db.select().from(shelvesTable).orderBy(shelvesTable.name);
  res.json(shelves);
});

router.post("/", authenticateToken, async (req, res) => {
  const { name, zone, capacity } = req.body as { name?: string; zone?: string; capacity?: number };
  if (!name || !zone) {
    res.status(400).json({ error: "name and zone required" });
    return;
  }
  const [shelf] = await db.insert(shelvesTable).values({ name, zone, capacity: capacity ?? 0 }).returning();
  res.status(201).json(shelf);
});

router.put("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const { name, zone, capacity } = req.body as { name?: string; zone?: string; capacity?: number };
  if (!name || !zone) {
    res.status(400).json({ error: "name and zone required" });
    return;
  }
  const [shelf] = await db.update(shelvesTable).set({ name, zone, capacity: capacity ?? 0 }).where(eq(shelvesTable.id, id)).returning();
  if (!shelf) {
    res.status(404).json({ error: "Shelf not found" });
    return;
  }
  res.json(shelf);
});

router.delete("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const linkedItems = await db.select({ id: inventoryTable.id }).from(inventoryTable).where(and(eq(inventoryTable.shelfId, id), eq(inventoryTable.isActive, true))).limit(1);
  if (linkedItems.length > 0) {
    res.status(400).json({ error: "Cannot delete. Items are currently assigned to this resource." });
    return;
  }
  const [shelf] = await db.delete(shelvesTable).where(eq(shelvesTable.id, id)).returning();
  if (!shelf) {
    res.status(404).json({ error: "Shelf not found" });
    return;
  }
  res.status(204).send();
});

export default router;

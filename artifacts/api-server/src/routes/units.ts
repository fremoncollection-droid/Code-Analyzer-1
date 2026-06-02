import { Router } from "express";
import { db, unitsTable, inventoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (_req, res) => {
  const units = await db.select().from(unitsTable).orderBy(unitsTable.name);
  res.json(units);
});

router.post("/", authenticateToken, async (req, res) => {
  const { name, abbreviation } = req.body as { name?: string; abbreviation?: string };
  if (!name || !abbreviation) {
    res.status(400).json({ error: "name and abbreviation required" });
    return;
  }
  const [unit] = await db.insert(unitsTable).values({ name, abbreviation }).returning();
  res.status(201).json(unit);
});

router.put("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const { name, abbreviation } = req.body as { name?: string; abbreviation?: string };
  if (!name || !abbreviation) {
    res.status(400).json({ error: "name and abbreviation required" });
    return;
  }
  const [unit] = await db.update(unitsTable).set({ name, abbreviation }).where(eq(unitsTable.id, id)).returning();
  if (!unit) {
    res.status(404).json({ error: "Unit not found" });
    return;
  }
  res.json(unit);
});

router.delete("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const linkedItems = await db.select({ id: inventoryTable.id }).from(inventoryTable).where(and(eq(inventoryTable.unitId, id), eq(inventoryTable.isActive, true))).limit(1);
  if (linkedItems.length > 0) {
    res.status(400).json({ error: "Cannot delete. Items are currently assigned to this resource." });
    return;
  }
  const [unit] = await db.delete(unitsTable).where(eq(unitsTable.id, id)).returning();
  if (!unit) {
    res.status(404).json({ error: "Unit not found" });
    return;
  }
  res.status(204).send();
});

export default router;

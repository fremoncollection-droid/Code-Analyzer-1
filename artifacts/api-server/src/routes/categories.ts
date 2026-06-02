import { Router } from "express";
import { db, categoriesTable, inventoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (_req, res) => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(cats);
});

router.post("/", authenticateToken, async (req, res) => {
  const { name, color, description } = req.body as { name?: string; color?: string; description?: string };
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [cat] = await db.insert(categoriesTable).values({ name, color: color || "#3B82F6", description }).returning();
  res.status(201).json(cat);
});

router.put("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const { name, color, description } = req.body as { name?: string; color?: string; description?: string };
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [cat] = await db.update(categoriesTable).set({ name, color: color || "#3B82F6", description }).where(eq(categoriesTable.id, id)).returning();
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(cat);
});

router.delete("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const linkedItems = await db.select({ id: inventoryTable.id }).from(inventoryTable).where(and(eq(inventoryTable.categoryId, id), eq(inventoryTable.isActive, true))).limit(1);
  if (linkedItems.length > 0) {
    res.status(400).json({ error: "Cannot delete. Items are currently assigned to this resource." });
    return;
  }
  const [cat] = await db.delete(categoriesTable).where(eq(categoriesTable.id, id)).returning();
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.status(204).send();
});

export default router;

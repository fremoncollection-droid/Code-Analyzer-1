import { Router } from "express";
import { db, locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const locations = await db.select().from(locationsTable).where(eq(locationsTable.isActive, true)).orderBy(locationsTable.name);
  res.json(locations);
});

router.get("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, id)).limit(1);
  if (!loc) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(loc);
});

router.post("/", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (!["admin", "manager"].includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { name, address, phone } = req.body as { name?: string; address?: string; phone?: string };
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [loc] = await db.insert(locationsTable).values({ name, address, phone }).returning();
  res.status(201).json(loc);
});

router.put("/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (!["admin", "manager"].includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = String(req.params.id);
  const { name, address, phone } = req.body as { name?: string; address?: string; phone?: string };
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [loc] = await db
    .update(locationsTable)
    .set({ name, address: address ?? null, phone: phone ?? null })
    .where(eq(locationsTable.id, id))
    .returning();
  if (!loc) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(loc);
});

router.delete("/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const id = String(req.params.id);
  await db.update(locationsTable).set({ isActive: false }).where(eq(locationsTable.id, id));
  res.status(204).send();
});

export default router;

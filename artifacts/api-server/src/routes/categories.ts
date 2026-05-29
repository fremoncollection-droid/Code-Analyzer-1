import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (_req, res) => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(cats);
});

router.post("/", authenticateToken, async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [cat] = await db.insert(categoriesTable).values({ name, description }).returning();
  res.status(201).json(cat);
});

export default router;

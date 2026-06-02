import { Router } from "express";
import { db, inventoryTable, categoriesTable } from "@workspace/db";
import { eq, and, ilike, lte, sql } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const { locationId, categoryId, search, lowStock } = req.query as Record<string, string>;
  const user = (req as any).user;

  let effectiveLocationId = locationId;
  if (user.role !== "admin" && user.role !== "manager" && user.locationId) {
    effectiveLocationId = user.locationId;
  }

  const conditions = [eq(inventoryTable.isActive, true)];
  if (effectiveLocationId) conditions.push(eq(inventoryTable.locationId, effectiveLocationId));
  if (categoryId) conditions.push(eq(inventoryTable.categoryId, categoryId));
  if (search) {
    // Search by name OR SKU (barcode scan support)
    conditions.push(
      sql`${inventoryTable.name} ILIKE ${`%${search}%`} OR ${inventoryTable.sku} ILIKE ${`%${search}%`}`
    );
  }
  if (lowStock === "true") conditions.push(lte(inventoryTable.quantity, inventoryTable.minQuantity));

  const items = await db
    .select({
      id: inventoryTable.id,
      name: inventoryTable.name,
      sku: inventoryTable.sku,
      description: inventoryTable.description,
      price: inventoryTable.price,
      wholesalePrice1: inventoryTable.wholesalePrice1,
      wholesalePrice2: inventoryTable.wholesalePrice2,
      cost: inventoryTable.cost,
      quantity: inventoryTable.quantity,
      minQuantity: inventoryTable.minQuantity,
      locationId: inventoryTable.locationId,
      categoryId: inventoryTable.categoryId,
      categoryName: categoriesTable.name,
      unit: inventoryTable.unit,
      isActive: inventoryTable.isActive,
      createdAt: inventoryTable.createdAt,
    })
    .from(inventoryTable)
    .leftJoin(categoriesTable, eq(inventoryTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(inventoryTable.name);

  res.json(items);
});

router.get("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const [item] = await db
    .select({
      id: inventoryTable.id,
      name: inventoryTable.name,
      sku: inventoryTable.sku,
      description: inventoryTable.description,
      price: inventoryTable.price,
      wholesalePrice1: inventoryTable.wholesalePrice1,
      wholesalePrice2: inventoryTable.wholesalePrice2,
      cost: inventoryTable.cost,
      quantity: inventoryTable.quantity,
      minQuantity: inventoryTable.minQuantity,
      locationId: inventoryTable.locationId,
      categoryId: inventoryTable.categoryId,
      categoryName: categoriesTable.name,
      unit: inventoryTable.unit,
      isActive: inventoryTable.isActive,
      createdAt: inventoryTable.createdAt,
    })
    .from(inventoryTable)
    .leftJoin(categoriesTable, eq(inventoryTable.categoryId, categoriesTable.id))
    .where(eq(inventoryTable.id, id))
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(item);
});

router.post("/", authenticateToken, async (req, res) => {
  const body = req.body as {
    name?: string; sku?: string; description?: string; price?: string;
    wholesalePrice1?: string; wholesalePrice2?: string; cost?: string;
    quantity?: number; minQuantity?: number; locationId?: string; categoryId?: string; unitId?: string; shelfId?: string; unit?: string;
  };
  if (!body.name || !body.price) {
    res.status(400).json({ error: "name and price required" });
    return;
  }
  const [item] = await db.insert(inventoryTable).values({
    name: body.name,
    sku: body.sku,
    description: body.description,
    price: body.price,
    wholesalePrice1: body.wholesalePrice1,
    wholesalePrice2: body.wholesalePrice2,
    cost: body.cost,
    quantity: body.quantity ?? 0,
    minQuantity: body.minQuantity ?? 0,
    locationId: body.locationId,
    categoryId: body.categoryId,
    unitId: body.unitId,
    shelfId: body.shelfId,
    unit: body.unit ?? "piece",
  }).returning();
  res.status(201).json(item);
});

router.patch("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  const body = req.body as Record<string, unknown>;
  const allowed = ["name", "sku", "description", "price", "wholesalePrice1", "wholesalePrice2", "cost", "quantity", "minQuantity", "locationId", "categoryId", "unitId", "shelfId", "unit", "isActive"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  const [item] = await db.update(inventoryTable).set(updates as any).where(eq(inventoryTable.id, id)).returning();
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(item);
});

router.delete("/:id", authenticateToken, async (req, res) => {
  const id = String(req.params.id);
  await db.update(inventoryTable).set({ isActive: false }).where(eq(inventoryTable.id, id));
  res.status(204).send();
});

export default router;

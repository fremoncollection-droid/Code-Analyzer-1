import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, authorize("admin", "manager"), async (req, res) => {
  const { role, locationId, isActive } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (role) conditions.push(eq(usersTable.role, role));
  if (locationId) conditions.push(eq(usersTable.locationId, locationId));
  if (isActive === "true" || isActive === "false") {
    conditions.push(eq(usersTable.isActive, isActive === "true"));
  }

  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      customerType: usersTable.customerType,
      wholesaleTier: usersTable.wholesaleTier,
      taxExempt: usersTable.taxExempt,
      locationId: usersTable.locationId,
      station: usersTable.station,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(usersTable.username);

  res.json(users);
});

router.post("/", authenticateToken, authorize("admin", "manager"), async (req, res) => {
  const body = req.body as {
    username?: string; email?: string; password?: string; pin?: string;
    role?: string; locationId?: string; station?: string;
  };

  if (!body.username || !body.email || !body.password || !body.role) {
    res.status(400).json({ error: "username, email, password, role required" });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null;

  const [user] = await db.insert(usersTable).values({
    username: body.username,
    email: body.email,
    passwordHash,
    pinHash,
    role: body.role,
    locationId: body.locationId ?? null,
    station: body.station ?? null,
  }).returning();

  res.status(201).json(user);
});

router.patch("/:id", authenticateToken, authorize("admin", "manager"), async (req, res) => {
  const id = String(req.params.id);
  const body = req.body as {
    email?: string; role?: string; locationId?: string; station?: string;
    isActive?: boolean; password?: string; pin?: string;
  };

  const updates: any = {};
  if (body.email) updates.email = body.email;
  if (body.role) updates.role = body.role;
  if (body.locationId !== undefined) updates.locationId = body.locationId;
  if (body.station !== undefined) updates.station = body.station;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.password) updates.passwordHash = await bcrypt.hash(body.password, 10);
  if (body.pin) updates.pinHash = await bcrypt.hash(body.pin, 10);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.delete("/:id", authenticateToken, authorize("admin"), async (req, res) => {
  const id = String(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;

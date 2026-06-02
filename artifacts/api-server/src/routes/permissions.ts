import { Router } from "express";
import { db, userPermissionsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

/**
 * GET /api/permissions
 * Admin only: list all permissions.
 * Users can query ?userId=:id to see their own.
 */
router.get("/", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { userId } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "admin") {
    if (userId) conditions.push(eq(userPermissionsTable.userId, userId));
  } else {
    // Non-admins can only see their own permissions
    conditions.push(eq(userPermissionsTable.userId, user.id));
  }

  const perms = await db
    .select({
      id: userPermissionsTable.id,
      userId: userPermissionsTable.userId,
      module: userPermissionsTable.module,
      canView: userPermissionsTable.canView,
      canCreate: userPermissionsTable.canCreate,
      canEdit: userPermissionsTable.canEdit,
      canDelete: userPermissionsTable.canDelete,
      canApprove: userPermissionsTable.canApprove,
    })
    .from(userPermissionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(userPermissionsTable.module);

  res.json(perms);
});

/**
 * GET /api/permissions/:userId
 * Get all permissions for a specific user.
 */
router.get("/:userId", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const targetId = String(req.params.userId);

  if (user.role !== "admin" && user.id !== targetId) {
    res.status(403).json({ error: "You can only view your own permissions" });
    return;
  }

  const perms = await db
    .select()
    .from(userPermissionsTable)
    .where(eq(userPermissionsTable.userId, targetId))
    .orderBy(userPermissionsTable.module);

  res.json(perms);
});

/**
 * PUT /api/permissions/:userId
 * Admin only: set permissions for a user by module.
 */
router.put("/:userId", authenticateToken, authorize("admin"), async (req, res) => {
  const targetId = String(req.params.userId);
  const body = req.body as {
    module?: string;
    canView?: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canApprove?: boolean;
  };

  if (!body.module) {
    res.status(400).json({ error: "module is required" });
    return;
  }

  // Check if user exists
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [perm] = await db
    .insert(userPermissionsTable)
    .values({
      userId: targetId,
      module: body.module,
      canView: body.canView ?? false,
      canCreate: body.canCreate ?? false,
      canEdit: body.canEdit ?? false,
      canDelete: body.canDelete ?? false,
      canApprove: body.canApprove ?? false,
    })
    .onConflictDoUpdate({
      target: [userPermissionsTable.userId, userPermissionsTable.module],
      set: {
        canView: body.canView ?? false,
        canCreate: body.canCreate ?? false,
        canEdit: body.canEdit ?? false,
        canDelete: body.canDelete ?? false,
        canApprove: body.canApprove ?? false,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(perm);
});

/**
 * DELETE /api/permissions/:id
 * Admin only: delete a specific permission record.
 */
router.delete("/:id", authenticateToken, authorize("admin"), async (req, res) => {
  const id = String(req.params.id);
  await db.delete(userPermissionsTable).where(eq(userPermissionsTable.id, id));
  res.status(204).send();
});

export default router;

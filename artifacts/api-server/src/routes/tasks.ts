import { Router } from "express";
import { db, tasksTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * GET /api/tasks
 * Cashiers see only their own tasks. Managers see tasks in their location.
 */
router.get("/", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { date, completed, priority } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "cashier") {
    conditions.push(eq(tasksTable.userId, user.id));
  } else if (user.role === "manager") {
    // Managers see tasks for all users in their location
    // For simplicity, managers see all tasks (in real app, you'd filter by location)
  }

  if (completed === "true" || completed === "false") {
    conditions.push(eq(tasksTable.completed, completed === "true"));
  }
  if (priority) conditions.push(eq(tasksTable.priority, priority));
  if (date) {
    const day = new Date(date);
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    conditions.push(gte(tasksTable.dueDate, start));
    conditions.push(lte(tasksTable.dueDate, end));
  }

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(tasksTable.dueDate);

  res.json(tasks);
});

/**
 * POST /api/tasks
 */
router.post("/", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const body = req.body as {
    title?: string; description?: string; type?: string;
    dueDate?: string; priority?: string; userId?: string;
  };

  if (!body.title || !body.dueDate) {
    res.status(400).json({ error: "title and dueDate are required" });
    return;
  }

  let userId = body.userId;
  if (user.role === "cashier") {
    userId = user.id;
  }

  const [task] = await db.insert(tasksTable).values({
    userId: userId ?? user.id,
    title: body.title,
    description: body.description,
    type: body.type ?? "call",
    dueDate: new Date(body.dueDate),
    priority: body.priority ?? "medium",
  }).returning();

  res.status(201).json(task);
});

/**
 * PATCH /api/tasks/:id
 */
router.patch("/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);
  const body = req.body as Record<string, unknown>;

  const [existing] = await db
    .select({ userId: tasksTable.userId })
    .from(tasksTable)
    .where(eq(tasksTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (user.role === "cashier" && existing.userId !== user.id) {
    res.status(403).json({ error: "You can only edit your own tasks" });
    return;
  }

  const allowed = ["title", "description", "type", "dueDate", "priority", "completed", "completedAt"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "completedAt" && body.completed) {
        updates[key] = new Date();
      } else if (key === "completedAt") {
        updates[key] = null;
      } else {
        updates[key] = body[key];
      }
    }
  }

  const [updated] = await db
    .update(tasksTable)
    .set(updates as any)
    .where(eq(tasksTable.id, id))
    .returning();

  res.json(updated);
});

/**
 * DELETE /api/tasks/:id
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);

  const [existing] = await db
    .select({ userId: tasksTable.userId })
    .from(tasksTable)
    .where(eq(tasksTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (user.role === "cashier" && existing.userId !== user.id) {
    res.status(403).json({ error: "You can only delete your own tasks" });
    return;
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).send();
});

export default router;

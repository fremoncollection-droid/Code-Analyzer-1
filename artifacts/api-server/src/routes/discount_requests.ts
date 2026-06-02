import { Router } from "express";
import { db, discountRequestsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

/**
 * GET /api/discount-requests
 * Admin/Manager: see all pending requests.
 * Cashier: see their own requests.
 */
router.get("/", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { status } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "cashier") {
    conditions.push(eq(discountRequestsTable.requestedBy, user.id));
  }

  if (status) {
    conditions.push(eq(discountRequestsTable.status, status));
  }

  const requests = await db
    .select({
      id: discountRequestsTable.id,
      transactionId: discountRequestsTable.transactionId,
      customerName: discountRequestsTable.customerName,
      requestedAmount: discountRequestsTable.requestedAmount,
      originalAmount: discountRequestsTable.originalAmount,
      reason: discountRequestsTable.reason,
      status: discountRequestsTable.status,
      requestedBy: discountRequestsTable.requestedBy,
      approvedBy: discountRequestsTable.approvedBy,
      approvedAt: discountRequestsTable.approvedAt,
      rejectionReason: discountRequestsTable.rejectionReason,
      createdAt: discountRequestsTable.createdAt,
    })
    .from(discountRequestsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(discountRequestsTable.createdAt));

  res.json(requests);
});

/**
 * POST /api/discount-requests
 * Cashier creates a discount request.
 */
router.post("/", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const body = req.body as {
    transactionId?: string; customerName?: string;
    requestedAmount?: string; originalAmount?: string;
    reason?: string;
  };

  if (!body.reason || !body.originalAmount || !body.requestedAmount) {
    res.status(400).json({ error: "reason, originalAmount, and requestedAmount are required" });
    return;
  }

  const [request] = await db.insert(discountRequestsTable).values({
    transactionId: body.transactionId,
    customerName: body.customerName,
    requestedAmount: body.requestedAmount,
    originalAmount: body.originalAmount,
    reason: body.reason,
    requestedBy: user.id,
    status: "pending",
  }).returning();

  res.status(201).json(request);
});

/**
 * POST /api/discount-requests/:id/approve
 * Manager/Admin only: approve a discount request.
 */
router.post("/:id/approve", authenticateToken, authorize("manager", "admin"), async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);

  const [existing] = await db
    .select()
    .from(discountRequestsTable)
    .where(eq(discountRequestsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (existing.status !== "pending") {
    res.status(400).json({ error: "Request is not pending" });
    return;
  }

  const [updated] = await db
    .update(discountRequestsTable)
    .set({
      status: "approved",
      approvedBy: user.id,
      approvedAt: new Date(),
    })
    .where(eq(discountRequestsTable.id, id))
    .returning();

  res.json(updated);
});

/**
 * POST /api/discount-requests/:id/reject
 * Manager/Admin only: reject a discount request.
 */
router.post("/:id/reject", authenticateToken, authorize("manager", "admin"), async (req, res) => {
  const user = (req as any).user;
  const id = String(req.params.id);
  const body = req.body as { rejectionReason?: string };

  const [existing] = await db
    .select()
    .from(discountRequestsTable)
    .where(eq(discountRequestsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (existing.status !== "pending") {
    res.status(400).json({ error: "Request is not pending" });
    return;
  }

  const [updated] = await db
    .update(discountRequestsTable)
    .set({
      status: "rejected",
      approvedBy: user.id,
      rejectionReason: body.rejectionReason ?? "No reason provided",
    })
    .where(eq(discountRequestsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;

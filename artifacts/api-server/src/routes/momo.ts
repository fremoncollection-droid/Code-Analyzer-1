import { Router } from "express";
import { nanoid } from "nanoid";
import { db, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// In-memory store for demo MoMo statuses (in production this would use the real API)
const momoPayments = new Map<string, { status: string; phone: string; amount: string; network: string }>();

router.post("/initiate", authenticateToken, async (req, res) => {
  const { phone, network, amount, reference, description } = req.body as {
    phone?: string; network?: string; amount?: string; reference?: string; description?: string;
  };

  if (!phone || !network || !amount || !reference) {
    res.status(400).json({ error: "phone, network, amount, reference required" });
    return;
  }

  // In a real integration you would call MTN/Telecel USSD Push API here.
  // For now we store a pending payment — the cashier must manually confirm after
  // the customer shows them the approval on their phone.
  const ref = reference ?? nanoid(12);
  momoPayments.set(ref, { status: "pending", phone, amount, network });

  res.json({
    success: true,
    reference: ref,
    status: "pending",
    message: `Payment request recorded for ${phone}. Ask the customer to approve on their phone.`,
  });
});

router.get("/status/:reference", authenticateToken, async (req, res) => {
  const reference = String(req.params.reference);
  const payment = momoPayments.get(reference);
  if (!payment) {
    res.json({ reference, status: "not_found", amount: null, phone: null, message: "Payment not found" });
    return;
  }
  res.json({
    reference,
    status: payment.status,
    amount: payment.amount,
    phone: payment.phone,
    message: payment.status === "successful" ? "Payment confirmed" : "Awaiting confirmation",
  });
});

// Cashier manually confirms payment after customer shows phone approval
router.post("/confirm/:reference", authenticateToken, (req, res) => {
  const reference = String(req.params.reference);
  const payment = momoPayments.get(reference);
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  payment.status = "successful";
  res.json({ success: true, reference, status: "successful" });
});

router.post("/webhook", async (req, res) => {
  const { reference, status, amount, phone } = req.body as {
    reference?: string; status?: string; amount?: string; phone?: string;
  };

  if (!reference || !status) {
    res.status(400).json({ error: "reference and status required" });
    return;
  }

  // Update stored payment status
  const payment = momoPayments.get(reference);
  if (payment) {
    payment.status = status;
  }

  // Update transaction if linked via momoReference
  if (status === "successful" || status === "failed") {
    const txs = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.momoReference, reference))
      .limit(1);
    if (txs.length > 0) {
      await db
        .update(transactionsTable)
        .set({
          paymentStatus: status === "successful" ? "completed" : "failed",
        })
        .where(eq(transactionsTable.id, txs[0].id));
    }
  }

  req.log.info({ reference, status, phone }, "MoMo webhook received");
  res.json({ received: true, reference, status });
});

export default router;
